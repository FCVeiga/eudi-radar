/**
 * EUDI Radar feed: posts written by the feed-writer agent
 * (agents/feed_writer.py) about opportunities, their updates, and news.
 *
 * "Top" (the default) works like Reddit's hot, with the AI score in place of
 * upvotes:  top = score × 0.5^(age / HALF_LIFE_DAYS). "Relevance" is the AI
 * score alone; "New" is newest first.
 * Keep HALF_LIFE_DAYS in sync with agents/feed_writer.py.
 *
 * Movement arrows compare the post's rank at the last pipeline run with the
 * run before (feed_posts.rank / prev_rank). Since every post decays at the
 * same rate, order only shifts when posts enter or leave the feed.
 */
import { getSupabaseServerClient } from '@/lib/supabase';
import { getActiveOpportunities, newsCategoryLabel, oppCategoryLabel } from '@/lib/data';

export const HALF_LIFE_DAYS = 4;
const UNSCORED = 30;

// Top (default) = AI score × novelty; Relevance = AI score alone; New = newest first.
export const FEED_VIEWS = [
  { slug: 'top', label: 'Top' },
  { slug: 'relevance', label: 'Relevance' },
  { slug: 'new', label: 'New' },
] as const;
export type FeedView = (typeof FEED_VIEWS)[number]['slug'];

type PostRow = {
  post_id: string; kind: 'opportunity' | 'news'; event: string;
  opportunity_id: string | null; news_id: string | null;
  category: string | null; country: string | null;
  headline: string; body: string | null; score: number | null;
  posted_at: string | null; created_at: string | null;
  rank: number | null; prev_rank: number | null;
};

export type FeedItem = {
  key: string;
  kind: 'opportunity' | 'news';
  event: string;
  href: string;
  headline: string;
  body: string | null;
  category: string;
  categoryLabel: string;
  kindLabel: string;
  country: string | null;
  at: Date;
  score: number;        // AI relevance / importance
  combined: number;     // score × novelty — what the card shows
  movement: 'up' | 'down' | 'same';
  deadline: string | null;
  isNew: boolean;
};

const decay = (at: Date, now: Date) =>
  Math.pow(0.5, Math.max(0, (now.getTime() - at.getTime()) / 86400_000) / HALF_LIFE_DAYS);

export async function getFeed(view: FeedView, now = new Date()) {
  const [{ data, error }, { opportunities }] = await Promise.all([
    getSupabaseServerClient().from('feed_posts').select('*').order('posted_at', { ascending: false }).limit(1000),
    getActiveOpportunities(),
  ]);
  const active = new Map(opportunities.map((o) => [o.opportunity_id, o]));

  const items: FeedItem[] = ((data || []) as PostRow[])
    // Opportunity posts only while the opportunity is still open; awards and news always.
    .filter((p) => p.kind === 'news' || p.event === 'awarded' || (p.opportunity_id && active.has(p.opportunity_id)))
    .map((p) => {
      const at = new Date(p.posted_at || p.created_at || now);
      const score = p.score ?? UNSCORED;
      const opp = p.opportunity_id ? active.get(p.opportunity_id) : undefined;
      const movement: FeedItem['movement'] =
        p.rank === null ? 'same'
          : p.prev_rank === null || p.rank < p.prev_rank ? 'up'
            : p.rank > p.prev_rank ? 'down' : 'same';
      return {
        key: p.post_id, kind: p.kind, event: p.event,
        href: p.kind === 'news' ? `/news/${p.news_id}` : `/opportunities/${p.opportunity_id}`,
        headline: p.headline, body: p.body,
        category: p.category || (p.kind === 'news' ? 'market' : 'rfp'),
        categoryLabel: p.kind === 'news' ? newsCategoryLabel(p.category) : oppCategoryLabel(p.category),
        kindLabel: p.kind === 'news' ? 'News' : 'Opportunity',
        country: p.country, at, score, combined: Math.round(score * decay(at, now)),
        movement, deadline: p.event === 'awarded' ? null : opp?.deadline ?? null,
        isNew: now.getTime() - at.getTime() <= 2 * 86400_000,
      };
    });

  const sorted =
    view === 'new' ? items.sort((a, b) => b.at.getTime() - a.at.getTime())
      : view === 'relevance' ? items.sort((a, b) => b.score - a.score || b.at.getTime() - a.at.getTime())
        : items.sort((a, b) => b.score * decay(b.at, now) - a.score * decay(a.at, now));
  return { items: sorted, error };
}

/** "3h ago", "2d ago", "14 Sep" — compact, like a feed. */
export function timeAgo(at: Date, now = new Date()) {
  const mins = Math.round((now.getTime() - at.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
