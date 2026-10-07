/**
 * Scopes (migration 025). A scope is one configuration of the radar inside a
 * workspace (lib/accounts.ts): a name, instructions (what the agents should
 * know), context documents, a search configuration and its own agents —
 * Search, Triage, Tender Evaluation, Proposal Manager, News Report. Workspace
 * admins create them (as many as the plan allows) and switch them on or off.
 *
 * What you see on Home, Community, Tenders, News and History is the work of
 * your current workspace's active scopes (signed out, on Free, or with none
 * active: the default scope).
 */
import 'server-only';
import { cache } from 'react';
import { getSupabaseServerClient } from '@/lib/supabase';
import { canEditWorkspace, getContext } from '@/lib/accounts';

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

export async function getWorkspaceScopes(workspaceId: string): Promise<Scope[]> {
  const { data } = await getSupabaseServerClient().from('scopes').select('*').eq('workspace_id', workspaceId).order('created_at');
  return (data || []).map(toScope);
}

/** A scope the user may configure: admin of its workspace, on a plan that allows customizing (else null). */
export async function getEditableScope(id: string): Promise<(Scope & { workspaceId: string }) | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await getSupabaseServerClient().from('scopes').select('*').eq('id', id).maybeSingle();
  if (!data?.workspace_id || !(await canEditWorkspace(data.workspace_id))) return null;
  return { ...toScope(data), workspaceId: data.workspace_id };
}

export async function getScope(id: string): Promise<Scope | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await getSupabaseServerClient().from('scopes').select('*').eq('id', id).maybeSingle();
  return data ? toScope(data) : null;
}

/**
 * The scopes whose results this viewer sees: the current workspace's active
 * scopes (up to what its plan allows), or the default scope when signed out,
 * on Free, or none is active. `own` = they're the workspace's scopes;
 * `canRun` = the viewer may run on-click agents for them (an admin on a plan
 * that allows customizing; members only see the results).
 */
export const getViewScopes = cache(async (): Promise<{ scopes: Scope[]; own: boolean; canRun: boolean }> => {
  const ctx = await getContext();
  const db = getSupabaseServerClient();
  if (ctx) {
    const limit = ctx.isDefault ? 1000 : ctx.plan.scopes;
    const { data } = limit > 0
      ? await db.from('scopes').select('*').eq('workspace_id', ctx.workspace.id).order('created_at').limit(limit)
      : { data: [] as any[] };
    const active = (data || []).filter((s: any) => s.active);
    if (active.length) return { scopes: active.map(toScope), own: true, canRun: ctx.canCustomize };
  }
  const { data } = await db.from('scopes').select('*').eq('is_default', true).limit(1);
  return { scopes: (data || []).map(toScope), own: false, canRun: false };
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
