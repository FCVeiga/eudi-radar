/** Locks for per-scope agent runs (scope_evaluations, scope_news_reports): two clicks share one run. */
import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase';

export async function lockRow(table: string, match: Record<string, string>, startedCol: string, errorCol: string, minutes: number) {
  const db = getSupabaseServerClient();
  await db.from(table).upsert(match, { onConflict: Object.keys(match).join(','), ignoreDuplicates: true });
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data } = await db.from(table).update({ [startedCol]: new Date().toISOString(), [errorCol]: null })
    .match(match).or(`${startedCol}.is.null,${startedCol}.lt.${cutoff}`).select(Object.keys(match)[0]);
  return !!data?.length;
}

export async function unlockRow(table: string, match: Record<string, string>, startedCol: string, errorCol: string, error: string | null) {
  await getSupabaseServerClient().from(table).update({ [startedCol]: null, [errorCol]: error }).match(match);
}

/** A shared evaluation has no workspace. A workspace that uploaded its own documents gets a separate row. */
function evaluationQuery(q: any, scopeId: string, opportunityId: string, workspaceId: string | null) {
  const next = q.eq('scope_id', scopeId).eq('opportunity_id', opportunityId);
  return workspaceId ? next.eq('workspace_id', workspaceId) : next.is('workspace_id', null);
}

export async function lockEvaluation(scopeId: string, opportunityId: string, workspaceId: string | null, startedCol: string, errorCol: string, minutes: number) {
  const db = getSupabaseServerClient();
  const { data: existing } = await evaluationQuery(db.from('scope_evaluations').select('id'), scopeId, opportunityId, workspaceId).maybeSingle();
  if (!existing) {
    const { error } = await db.from('scope_evaluations').insert({ scope_id: scopeId, opportunity_id: opportunityId, workspace_id: workspaceId });
    if (error && !/duplicate key|unique/i.test(error.message)) throw new Error(error.message);
  }
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data } = await evaluationQuery(
    db.from('scope_evaluations').update({ [startedCol]: new Date().toISOString(), [errorCol]: null }).or(`${startedCol}.is.null,${startedCol}.lt.${cutoff}`),
    scopeId, opportunityId, workspaceId,
  ).select('id');
  return !!data?.length;
}

export async function unlockEvaluation(scopeId: string, opportunityId: string, workspaceId: string | null, startedCol: string, errorCol: string, error: string | null) {
  await evaluationQuery(
    getSupabaseServerClient().from('scope_evaluations').update({ [startedCol]: null, [errorCol]: error }),
    scopeId, opportunityId, workspaceId,
  );
}

export const friendly = (e: any) => {
  const raw = String(e?.message || e);
  return /credit balance/i.test(raw) ? 'the Anthropic API account is out of credit' : raw.slice(0, 200);
};
