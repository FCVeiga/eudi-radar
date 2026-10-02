/**
 * The action bar under cards: likes, comments, reposts — counts for a set of
 * items, plus what the signed-in user has liked / reposted / hidden.
 */
import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export type ItemType = 'post' | 'news' | 'tender';
export type Engagement = { likes: number; comments: number; reposts: number; liked: boolean; reposted: boolean };
export type EngagementMap = { signedIn: boolean; get: (id: string) => Engagement; hidden: Set<string> };

const tally = (rows: any[] | null, key = 'item_id') => {
  const m = new Map<string, number>();
  for (const r of rows || []) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
  return m;
};

export async function getEngagement(type: ItemType, ids: string[]): Promise<EngagementMap> {
  const user = await getCurrentUser();
  const db = getSupabaseServerClient();
  if (!ids.length) return { signedIn: !!user, get: () => ({ likes: 0, comments: 0, reposts: 0, liked: false, reposted: false }), hidden: new Set() };
  const [likes, comments, reposts, hidden] = await Promise.all([
    db.from('likes').select('item_id, user_id').eq('item_type', type).in('item_id', ids),
    db.from('comments').select('item_id').eq('item_type', type).in('item_id', ids),
    db.from('reposts').select('item_id, user_id').eq('item_type', type).in('item_id', ids),
    user ? db.from('hidden_items').select('item_id').eq('user_id', user.id).eq('item_type', type) : Promise.resolve({ data: [] as any[] }),
  ]);
  const likeN = tally(likes.data), commentN = tally(comments.data), repostN = tally(reposts.data);
  const liked = new Set((likes.data || []).filter((r: any) => r.user_id === user?.id).map((r: any) => r.item_id));
  const reposted = new Set((reposts.data || []).filter((r: any) => r.user_id === user?.id).map((r: any) => r.item_id));
  return {
    signedIn: !!user,
    hidden: new Set((hidden.data || []).map((r: any) => r.item_id)),
    get: (id) => ({ likes: likeN.get(id) ?? 0, comments: commentN.get(id) ?? 0, reposts: repostN.get(id) ?? 0, liked: liked.has(id), reposted: reposted.has(id) }),
  };
}
