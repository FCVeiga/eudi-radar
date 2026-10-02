/**
 * The home feed: opportunities and news in one list, ranked like Reddit's
 * "hot" — but the AI's relevance score stands in for upvotes.
 *
 *   hot = score × 0.5^(age / HALF_LIFE)
 *
 * so an item's weight halves every HALF_LIFE_DAYS. A fresh 60 beats a 95 from
 * a week ago; nothing old and marginal survives near the top.
 *
 * "Age" runs from when the item entered the feed:
 *   - news: its publication date (old news found today is still old news);
 *   - opportunities: when the radar first found them, bumped by any later
 *     update (e.g. a deadline extension) — like a post rising on new activity.
 */
import {
  NewsItem, Opportunity, getActiveOpportunities, getNews, getRecentChanges,
  isNew, isUpdated, newsCategoryLabel, oppCategoryLabel,
} from '@/lib/data';

export const HALF_LIFE_DAYS = 4;
// News whose importance couldn't be scored ranks as "marginal".
const UNSCORED = 30;

export type FeedItem = {
  key: string;
  kind: 'opportunity' | 'news';
  href: string;
  title: string;
  summary: string | null;
  category: string;          // css tag class: rfp | rfi | grant | signal | regulation | industry | market
  categoryLabel: string;
  kindLabel: string;         // "Opportunity" | "News"
  country: string | null;
  source: string | null;     // domain or authority
  at: Date;                  // feed time (see above)
  score: number;             // AI relevance / importance, 0-100
  hot: number;
  deadline: string | null;
  isNew: boolean;
  update: string | null;     // latest change, e.g. "Deadline extended: …"
};

function domain(url: string | null) {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function hot(score: number, at: Date, now: Date) {
  const ageDays = Math.max(0, (now.getTime() - at.getTime()) / 86400_000);
  return score * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export async function getFeed(now = new Date()) {
  const [{ opportunities, error: oErr }, { news, error: nErr }, { changes }] =
    await Promise.all([getActiveOpportunities(), getNews(), getRecentChanges(30, 200)]);

  const latestChange = new Map<string, string>();
  for (const c of changes) if (!latestChange.has(c.opportunity_id) && c.description) latestChange.set(c.opportunity_id, c.description);

  const opp = (o: Opportunity): FeedItem => {
    const found = new Date(o.first_detected || o.publication_date || now);
    const updated = isUpdated(o, now) && o.last_change ? new Date(o.last_change) : null;
    const at = updated && updated > found ? updated : found;
    const score = o.opportunity_relevance_score ?? UNSCORED;
    return {
      key: `o:${o.opportunity_id}`, kind: 'opportunity', href: `/opportunities/${o.opportunity_id}`,
      title: o.title, summary: o.summary, category: o.opportunity_type || 'rfp',
      categoryLabel: oppCategoryLabel(o.opportunity_type), kindLabel: 'Opportunity',
      country: o.country, source: o.authority || domain(o.official_url), at, score, hot: hot(score, at, now),
      deadline: o.deadline, isNew: isNew(o, now),
      update: updated ? latestChange.get(o.opportunity_id) ?? 'Updated' : null,
    };
  };

  const newsItem = (n: NewsItem): FeedItem => {
    const at = new Date(n.published_date || n.created_at || now);
    const score = n.relevance_score ?? UNSCORED;
    return {
      key: `n:${n.news_id}`, kind: 'news', href: `/news/${n.news_id}`,
      title: n.title, summary: n.summary || n.excerpt, category: n.category || 'market',
      categoryLabel: newsCategoryLabel(n.category), kindLabel: 'News',
      country: n.region && n.region !== 'EU / International' ? n.region : null,
      source: n.source_name?.replace(/^www\./, '') || null, at, score, hot: hot(score, at, now),
      deadline: null, isNew: now.getTime() - at.getTime() <= 2 * 86400_000, update: null,
    };
  };

  const items = [...opportunities.map(opp), ...news.map(newsItem)].sort((a, b) => b.hot - a.hot);
  return { items, error: oErr || nErr };
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

