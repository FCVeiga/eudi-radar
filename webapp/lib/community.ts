/**
 * Community Feed: members' posts, ranked for the person looking.
 *
 * Score (0–100) = 100 × (0.35·relevance + 0.20·following + 0.20·likes + 0.25·recency)
 *   relevance — how well the post's tags (and title) match the reader's
 *               interests: their active scopes' search configurations plus the
 *               tags of posts they wrote or liked
 *   following — the author is someone the reader follows (or the reader)
 *   likes     — total hearts, on a log scale (100 likes ≈ full marks)
 *   recency   — halves every 3 days
 * "Best" sorts by that score, "New" by date, "Top" by likes.
 */
import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getViewScopes } from '@/lib/scopes';

export type CommunityView = 'best' | 'new' | 'top';
export const COMMUNITY_VIEWS: { slug: CommunityView; label: string }[] = [
  { slug: 'best', label: 'Best' }, { slug: 'new', label: 'New' }, { slug: 'top', label: 'Top' },
];

export type Media = { type: 'image' | 'video'; url: string; path?: string };
export type PostCard = {
  id: string; title: string; excerpt: string | null; media: Media | null; tags: string[];
  author: { username: string; displayName: string; avatarUrl: string | null } | null;
  createdAt: string; likes: number; comments: number;
  score: number; parts: { relevance: number; following: number; likes: number; recency: number };
};

const W = { relevance: 0.35, following: 0.2, likes: 0.2, recency: 0.25 };
const HALF_LIFE_DAYS = 3;
const STOP = new Set('the and for with from that this your have will into about over more than also only their there what when which while news tender tenders public digital services service system systems'.split(' '));

const words = (s: string): string[] => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? ([] as string[])).filter((w: string) => w.length >= 3 && !STOP.has(w));

/** Markdown → a short plain-text excerpt for cards. */
export function excerpt(md: string | null, max = 280): string | null {
  if (!md) return null;
  const text = md.replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '').replace(/[*_`~|]/g, '').replace(/^-{3,}$/gm, ' ').replace(/\s+/g, ' ').trim();
  return text ? (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text) : null;
}

/** What the reader cares about: their active scopes' search configurations, plus tags of their own and liked posts. */
async function interests(userId: string | null): Promise<Set<string>> {
  const db = getSupabaseServerClient();
  const terms = new Set<string>();
  const [{ scopes }, { data: agent }] = await Promise.all([
    getViewScopes(),
    db.from('agent_settings').select('default_prompt').eq('agent_key', 'search').maybeSingle(),
  ]);
  let builtin: any = {};
  try { builtin = JSON.parse(agent?.default_prompt || '{}'); } catch { /* none */ }
  // A generic scope (General) has no topic words: ranking then rests on likes, following and recency.
  for (const cfg of (scopes.length ? scopes.map((s) => s.searchConfig?.mode === 'generic' ? {} : s.searchConfig || builtin) : [builtin])) {
    for (const p of [cfg.topic || '', ...(cfg.ted_phrases || []).slice(0, 40), ...(cfg.news_queries || [])]) words(String(p)).forEach((w) => terms.add(w));
  }
  if (userId) {
    const [{ data: own }, { data: liked }] = await Promise.all([
      db.from('posts').select('tags').eq('user_id', userId).limit(100),
      db.from('likes').select('item_id').eq('user_id', userId).eq('item_type', 'post').limit(200),
    ]);
    const likedIds = (liked || []).map((l: any) => l.item_id);
    const { data: likedPosts } = likedIds.length ? await db.from('posts').select('tags').in('id', likedIds) : { data: [] as any[] };
    for (const p of [...(own || []), ...(likedPosts || [])]) for (const t of p.tags || []) words(t).forEach((w) => terms.add(w));
  }
  return terms;
}

export async function getCommunityFeed(view: CommunityView, userId: string | null, now = new Date()): Promise<PostCard[]> {
  const since = new Date(now.getTime() - 120 * 86400_000).toISOString();
  const { data: posts } = await getSupabaseServerClient().from('posts')
    .select('id, user_id, title, body, tags, media, like_count, created_at').gte('created_at', since)
    .order('created_at', { ascending: false }).limit(400);
  const cards = await scorePosts(posts || [], userId, now);
  return view === 'new' ? cards.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : view === 'top' ? cards.sort((a, b) => b.likes - a.likes || b.score - a.score)
      : cards.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
}

/** The posts a user liked, newest like first (profile → Following). */
export async function getLikedPosts(userId: string, now = new Date()): Promise<{ post: PostCard; likedAt: string }[]> {
  const db = getSupabaseServerClient();
  const { data: likes } = await db.from('likes').select('item_id, created_at').eq('user_id', userId).eq('item_type', 'post')
    .order('created_at', { ascending: false }).limit(200);
  if (!likes?.length) return [];
  const { data: posts } = await db.from('posts').select('id, user_id, title, body, tags, media, like_count, created_at').in('id', likes.map((l: any) => l.item_id));
  const cards = new Map((await scorePosts(posts || [], userId, now)).map((c) => [c.id, c]));
  return likes.flatMap((l: any) => (cards.has(l.item_id) ? [{ post: cards.get(l.item_id)!, likedAt: l.created_at }] : []));
}

/** Score posts for a reader (see the formula at the top). */
async function scorePosts(rows: any[], userId: string | null, now: Date): Promise<PostCard[]> {
  if (!rows.length) return [];
  const db = getSupabaseServerClient();
  const ids = rows.map((p: any) => p.id);
  const [{ data: follows }, terms, { data: authors }, { data: comments }] = await Promise.all([
    userId ? db.from('user_follows').select('followee_id').eq('follower_id', userId) : Promise.resolve({ data: [] as any[] }),
    interests(userId),
    db.from('profiles').select('id, username, display_name, avatar_url').in('id', Array.from(new Set(rows.map((p: any) => p.user_id)))),
    db.from('comments').select('post_id').in('post_id', ids),
  ]);
  const who = new Map((authors || []).map((a: any) => [a.id, { username: a.username, displayName: a.display_name || a.username, avatarUrl: a.avatar_url }]));
  const followed = new Set((follows || []).map((f: any) => f.followee_id));
  const commentCount = new Map<string, number>();
  for (const c of comments || []) commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);

  return rows.map((p: any): PostCard => {
    const tagHits = (p.tags || []).filter((t: string) => words(t).some((w) => terms.has(w))).length;
    const titleHits = words(p.title).filter((w) => terms.has(w)).length;
    const relevance = Math.min(1, tagHits / 2 + titleHits * 0.25);
    const following = userId && (followed.has(p.user_id) || p.user_id === userId) ? 1 : 0;
    const likes = Math.min(1, Math.log10(1 + (p.like_count || 0)) / 2);
    const ageDays = Math.max(0, (now.getTime() - new Date(p.created_at).getTime()) / 86400_000);
    const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const score = Math.round(100 * (W.relevance * relevance + W.following * following + W.likes * likes + W.recency * recency));
    return {
      id: p.id, title: p.title, excerpt: excerpt(p.body), media: (Array.isArray(p.media) ? p.media : [])[0] ?? null, tags: p.tags || [],
      author: who.get(p.user_id) ?? null, createdAt: p.created_at, likes: p.like_count || 0, comments: commentCount.get(p.id) ?? 0,
      score, parts: { relevance, following, likes, recency },
    };
  });
}

/** Default tag suggestions for the post editor (plus the most used tags). */
export async function tagSuggestions(): Promise<string[]> {
  const base = ['software', 'cybersecurity', 'government', 'regulation', 'eudi wallet', 'digital identity', 'procurement', 'eidas', 'trust services', 'interoperability'];
  const { data } = await getSupabaseServerClient().from('posts').select('tags').order('created_at', { ascending: false }).limit(300);
  const count = new Map<string, number>();
  for (const p of data || []) for (const t of p.tags || []) count.set(t, (count.get(t) ?? 0) + 1);
  const popular = Array.from(count.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return Array.from(new Set([...base, ...popular])).slice(0, 16);
}
