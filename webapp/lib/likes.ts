import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export type LikeType = 'tender' | 'news' | 'post';
export type LikeState = { signedIn: boolean; liked: Set<string> };

/** Which of these items the signed-in user has liked (hearts on cards and pages). */
export async function getLikes(type: LikeType, ids: string[]): Promise<LikeState> {
  const user = await getCurrentUser();
  if (!user || !ids.length) return { signedIn: !!user, liked: new Set() };
  const { data } = await getSupabaseServerClient().from('likes').select('item_id')
    .eq('user_id', user.id).eq('item_type', type).in('item_id', ids);
  return { signedIn: true, liked: new Set((data || []).map((r: any) => r.item_id)) };
}

/** Feed items mix tenders and news: liked ids keyed "tender:<id>" / "news:<id>". */
export async function getFeedLikes(hrefs: string[]): Promise<LikeState> {
  const user = await getCurrentUser();
  if (!user || !hrefs.length) return { signedIn: !!user, liked: new Set() };
  const { data } = await getSupabaseServerClient().from('likes').select('item_type, item_id').eq('user_id', user.id);
  return { signedIn: true, liked: new Set((data || []).map((r: any) => `${r.item_type}:${r.item_id}`)) };
}

/** "/tenders/abc" → ["tender", "abc"], "/news/xyz" → ["news", "xyz"]. */
export function likeTarget(href: string): [LikeType, string] | null {
  const m = href.match(/^\/(tenders|news|posts)\/([\w-]{6,64})$/);
  return m ? [m[1] === 'tenders' ? 'tender' : m[1] === 'posts' ? 'post' : 'news', m[2]] : null;
}
