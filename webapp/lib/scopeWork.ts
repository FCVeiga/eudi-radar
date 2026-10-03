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

export const friendly = (e: any) => {
  const raw = String(e?.message || e);
  return /credit balance/i.test(raw) ? 'the Anthropic API account is out of credit' : raw.slice(0, 200);
};
