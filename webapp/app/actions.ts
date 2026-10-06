'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { getEditableScope, getViewScopes } from '@/lib/scopes';
import { refreshDueFeeds, resolveSource } from '@/lib/sources';
import { FREQUENCIES, METHODS, Method, NOT_CONNECTABLE, SOURCE_TYPES } from '@/lib/sourceMeta';

export type SaveSourceState = { ok: boolean; message: string } | null;

/** Add a source (no source_id) or update one, from the Following sidebar's modal. */
export async function saveSource(_prev: SaveSourceState, form: FormData): Promise<SaveSourceState> {
  if (!(await getCurrentUser())) return { ok: false, message: 'Log in to add or change sources.' };
  const id = String(form.get('source_id') || '');
  const type = String(form.get('source_type') || '');
  const name = String(form.get('name') || '').trim();
  const input = String(form.get('url') || '').trim();
  const country = String(form.get('country') || '') || null;
  const requested = String(form.get('method') || 'auto');
  const every = Number(form.get('check_every_days') || 7);
  const enabled = form.get('enabled') === 'on';

  if (!SOURCE_TYPES.some((t) => t.value === type)) return { ok: false, message: 'Pick a type.' };
  if (!input) return { ok: false, message: 'Enter a URL or handle.' };
  if (!(FREQUENCIES as readonly number[]).includes(every)) return { ok: false, message: 'Pick how often to check.' };
  if (requested !== 'auto' && !(requested in METHODS)) return { ok: false, message: 'Pick a monitoring method.' };

  const supabase = getSupabaseServerClient();
  const current = id ? (await supabase.from('sources').select('*').eq('source_id', id).single()).data : null;
  if (id && !current) return { ok: false, message: 'That source no longer exists.' };

  // Resolve the feed / method when adding, when the address changed, or on "auto".
  let resolved = current
    ? { url: current.url, handle: current.handle, feedUrl: current.feed_url, method: current.method as Method }
    : null;
  const addressChanged = !current || input !== (current.handle || current.url);
  if (addressChanged || requested === 'auto') {
    try {
      resolved = await resolveSource(type, input);
    } catch (e: any) {
      return { ok: false, message: String(e?.message || e) };
    }
  }
  let method: Method = requested === 'auto' ? resolved!.method : (requested as Method);
  if (current?.method === 'ted') method = 'ted';  // TED keeps its API
  if (NOT_CONNECTABLE.includes(type)) method = 'off';
  if (method === 'rss' && !resolved!.feedUrl) return { ok: false, message: 'No RSS/Atom feed found at that address — use site search instead.' };
  if (method === 'site_search' && !resolved!.url) return { ok: false, message: 'Site search needs a website URL.' };

  if (!current) {
    const { data: dupe } = await supabase.from('sources').select('name')
      .or(`url.eq."${resolved!.url}",handle.eq."${resolved!.handle ?? '__none__'}"`).limit(1);  // quoted: URLs may hold commas
    if (dupe?.length) return { ok: false, message: `Already following this as “${dupe[0].name}”.` };
  }

  const row = {
    name: name || resolved!.handle || new URL(resolved!.url!).hostname.replace(/^www\./, ''),
    source_type: type, country, url: resolved!.url, handle: resolved!.handle, feed_url: resolved!.feedUrl,
    method, enabled, check_every_days: method === 'rss' || method === 'ted' ? 1 : every,
    rss_available: !!resolved!.feedUrl,
    // a changed address or method means the next run should check it straight away
    ...(addressChanged || method !== current?.method ? { last_checked: null, last_error: null } : {}),
  };
  const { error } = current
    ? await supabase.from('sources').update(row).eq('source_id', id)
    : await supabase.from('sources').insert({
        ...row, source_id: `USR-${Date.now().toString(36)}`, status: 'ACTIVE', priority: 3,
      });
  if (error) return { ok: false, message: error.message };

  if (method === 'rss' && enabled) await refreshDueFeeds();  // feed items show up straight away
  revalidatePath('/', 'layout');
  const how = method === 'off'
    ? NOT_CONNECTABLE.includes(type) ? 'listed — this platform needs API access before it can be monitored' : 'listed, not monitored'
    : method === 'rss' ? 'monitored through its feed' : method === 'ted' ? 'monitored through the TED API'
      : `searched every ${every === 1 ? 'day' : `${every} days`}`;
  return { ok: true, message: `${row.name}: ${enabled ? how : 'paused'}.` };
}

/** Opening a news page starts the News Report Agent for a scope the viewer is looking through. */
export async function startNewsReport(newsId: string, scopeId: string) {
  if (!/^[0-9a-f]{16}$/.test(newsId)) return { status: 'error' as const, message: 'unknown news item' };
  const { scopes } = await getViewScopes();
  if (!scopes.some((s) => s.id === scopeId)) return { status: 'error' as const, message: 'that scope isn’t one you’re viewing' };
  const { ensureNewsReport } = await import('@/lib/newsReport');
  const result = await ensureNewsReport(newsId, scopeId);
  if (result.status === 'done') revalidatePath(`/news/${newsId}`);
  return result;
}

/** Running on-click agents is for the workspace's admins (on a plan that allows it); members see the results. */
async function ownsScope(scopeId: string) {
  return !!(await getEditableScope(scopeId));
}

/** The tender page's "Run" button: starts the Tender Evaluation Agent for one of your scopes. */
export async function startTenderEvaluation(opportunityId: string, scopeId: string) {
  if (!(await ownsScope(scopeId))) return { status: 'error' as const, message: 'only the workspace’s admins can run this agent' };
  if (!/^[0-9a-f]{12,40}$/.test(opportunityId)) return { status: 'error' as const, message: 'unknown opportunity' };
  const { ensureEvaluation } = await import('@/lib/tenderEvaluation');
  const result = await ensureEvaluation(opportunityId, scopeId);
  if (result.status === 'done') revalidatePath(`/tenders/${opportunityId}`);
  return result;
}

/** The tender page's "Prepare proposal brief" button: starts the Proposal Manager Agent for one of your scopes. */
export async function startProposalBrief(opportunityId: string, scopeId: string) {
  if (!(await ownsScope(scopeId))) return { status: 'error' as const, message: 'log in, and pick one of your scopes' };
  if (!/^[0-9a-f]{12,40}$/.test(opportunityId)) return { status: 'error' as const, message: 'unknown tender' };
  const { ensureProposal } = await import('@/lib/proposalManager');
  const result = await ensureProposal(opportunityId, scopeId);
  if (result.status === 'done') revalidatePath(`/tenders/${opportunityId}`);
  return result;
}
