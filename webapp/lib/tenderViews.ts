import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase';

/** Count this opening and say whether the requirements section is still inside the plan's monthly limit. `null` is unlimited. */
export async function allowRequirements(userId: string, limit: number | null): Promise<boolean> {
  if (limit == null) return true;
  const db = getSupabaseServerClient();
  const month = new Date().toISOString().slice(0, 7);
  const { data: row } = await db.from('tender_page_views').select('views').eq('user_id', userId).eq('month', month).maybeSingle();
  const prev = row?.views ?? 0;
  if (row) await db.from('tender_page_views').update({ views: prev + 1 }).eq('user_id', userId).eq('month', month);
  else await db.from('tender_page_views').insert({ user_id: userId, month, views: 1 });
  return prev < limit;
}
