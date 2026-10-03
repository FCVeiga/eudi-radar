/**
 * Scopes (migration 025). A scope is a user's configuration of the radar:
 * a name, instructions (what the agents should know), context documents, a
 * search configuration and its own agents — Search, Triage, Tender
 * Evaluation, Proposal Manager, News Report. Users create as many as they
 * want and switch them active or inactive.
 *
 * What you see on Home, Community, Tenders, News and History is the work of
 * your active scopes (or, signed out / with none active, the default scope).
 */
import 'server-only';
import { cache } from 'react';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const MAX_ACTIVE_SCOPES = 5;
export const SCOPE_AGENT_KEYS = ['search', 'triage', 'tender_evaluation', 'proposal_manager', 'news_report'];
export const PLATFORM_AGENT_KEYS = ['tender_documents', 'tender_analysis', 'feed_writer', 'translator'];

export type Scope = {
  id: string; ownerId: string | null; name: string; instructions: string | null; active: boolean; isDefault: boolean;
  searchScope: string | null; searchConfig: Record<string, any> | null; searchStatus: string | null; searchError: string | null;
  parsedAt: string | null; createdAt: string;
};

const toScope = (r: any): Scope => ({
  id: r.id, ownerId: r.owner_id, name: r.name, instructions: r.instructions, active: r.active, isDefault: r.is_default,
  searchScope: r.search_scope, searchConfig: r.search_config, searchStatus: r.search_status, searchError: r.search_error,
  parsedAt: r.search_parsed_at, createdAt: r.created_at,
});

export async function getMyScopes(userId: string): Promise<Scope[]> {
  const { data } = await getSupabaseServerClient().from('scopes').select('*').eq('owner_id', userId).order('created_at');
  return (data || []).map(toScope);
}

/** A scope the user owns (null if it isn't theirs). */
export async function getOwnScope(id: string, userId: string): Promise<Scope | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await getSupabaseServerClient().from('scopes').select('*').eq('id', id).eq('owner_id', userId).maybeSingle();
  return data ? toScope(data) : null;
}

export async function getScope(id: string): Promise<Scope | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await getSupabaseServerClient().from('scopes').select('*').eq('id', id).maybeSingle();
  return data ? toScope(data) : null;
}

/**
 * The scopes whose results this viewer sees: their active scopes, or the
 * default scope when signed out or none is active. `own` says whether they
 * are the viewer's own (so they can run agents for them).
 */
export const getViewScopes = cache(async (): Promise<{ scopes: Scope[]; own: boolean }> => {
  const user = await getCurrentUser();
  const db = getSupabaseServerClient();
  if (user) {
    const { data } = await db.from('scopes').select('*').eq('owner_id', user.id).eq('active', true).order('created_at');
    if (data?.length) return { scopes: data.map(toScope), own: true };
  }
  const { data } = await db.from('scopes').select('*').eq('is_default', true).limit(1);
  return { scopes: (data || []).map(toScope), own: false };
});

export type ScopeItems = { ids: string[]; relevance: Map<string, number>; scopesOf: Map<string, string[]> };

/** Tenders or news found by the viewer's scopes, with the best relevance any of them gave. */
export const getScopeItems = cache(async (type: 'tender' | 'news'): Promise<ScopeItems | null> => {
  const { scopes } = await getViewScopes();
  if (!scopes.length) return null;  // no scopes at all yet: show everything
  const { data } = await getSupabaseServerClient().from('scope_items').select('scope_id, item_id, relevance')
    .eq('item_type', type).in('scope_id', scopes.map((s) => s.id)).limit(20000);
  const relevance = new Map<string, number>();
  const scopesOf = new Map<string, string[]>();
  for (const r of data || []) {
    relevance.set(r.item_id, Math.max(relevance.get(r.item_id) ?? -1, r.relevance ?? 0));
    scopesOf.set(r.item_id, [...(scopesOf.get(r.item_id) || []), r.scope_id]);
  }
  return { ids: Array.from(relevance.keys()), relevance, scopesOf };
});

/** Agent switches and fine-tuning for one scope's agents (no row = on, default prompt). */
export async function getScopeAgents(scopeId: string) {
  const { data } = await getSupabaseServerClient().from('scope_agent_settings').select('*').eq('scope_id', scopeId);
  return new Map((data || []).map((a: any) => [a.agent_key, a]));
}

/** Is this scope agent switched on for the scope? */
export async function scopeAgentEnabled(scopeId: string, key: string) {
  const { data } = await getSupabaseServerClient().from('scope_agent_settings').select('enabled').eq('scope_id', scopeId).eq('agent_key', key).maybeSingle();
  return data?.enabled ?? true;
}
