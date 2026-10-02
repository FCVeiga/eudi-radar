/**
 * Site search (navbar box → /search?q=…). Every word must match somewhere in
 * an item's original fields or in the agent-written post about it — the post
 * copy is English, so this also finds notices whose titles are in Greek or
 * German. Results come back as feed items so they render as post cards.
 */
import { getSupabaseServerClient } from '@/lib/supabase';
import { NewsItem, Opportunity, isNew, newsCategoryLabel, oppCategoryLabel } from '@/lib/data';
import { FeedItem, HALF_LIFE_DAYS } from '@/lib/feed';

const MAX_WORDS = 6;

export function searchWords(q: string) {
  return q.toLowerCase().split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}\-]/gu, ''))  // strip PostgREST filter syntax (, ( ) * etc.)
    .filter((w) => w.length >= 2)
    .slice(0, MAX_WORDS);
}

const ilikeAny = (fields: string[], w: string) => fields.map((f) => `${f}.ilike.*${w}*`).join(',');

function isActive(o: Opportunity, now: Date) {
  return (o.status === 'OPEN' || o.status === 'SIGNAL') && (!o.deadline || new Date(o.deadline) >= now);
}

function statusLabel(o: Opportunity, now: Date) {
  if (isActive(o, now)) return null;
  if (o.status === 'AWARDED') return 'Awarded';
  if (o.status === 'REJECTED') return 'Not an opportunity';
  if (o.status === 'UNVERIFIED') return 'Unverified';
  return 'Closed';
}

export async function search(q: string, now = new Date()) {
  const words = searchWords(q);
  if (!words.length) return { opportunities: [] as FeedItem[], news: [] as FeedItem[] };
  const db = getSupabaseServerClient();

  const filtered = (table: string, fields: string[], select = '*') => {
    let query = db.from(table).select(select).limit(200);
    for (const w of words) query = query.or(ilikeAny(fields, w));
    return query;
  };
  const [opps, news, posts] = await Promise.all([
    filtered('opportunities', ['title', 'summary', 'authority', 'country']),
    filtered('news_items', ['title', 'summary', 'excerpt', 'source_name']),
    filtered('feed_posts', ['headline', 'body'], 'opportunity_id, news_id'),
  ]);

  // Union of direct matches and items whose post matched, then fetch what's missing.
  const oppIds = new Set<string>([...(opps.data || []).map((o: any) => o.opportunity_id),
    ...(posts.data || []).map((p: any) => p.opportunity_id).filter(Boolean)]);
  const newsIds = new Set<string>([...(news.data || []).map((n: any) => n.news_id),
    ...(posts.data || []).map((p: any) => p.news_id).filter(Boolean)]);
  const haveOpp = new Set((opps.data || []).map((o: any) => o.opportunity_id));
  const haveNews = new Set((news.data || []).map((n: any) => n.news_id));
  const missingOpp = [...oppIds].filter((id) => !haveOpp.has(id));
  const missingNews = [...newsIds].filter((id) => !haveNews.has(id));
  const postIds = [...[...oppIds].map((id) => `opp:${id}`), ...[...newsIds].map((id) => `news:${id}`)];

  const [extraOpps, extraNews, copy] = await Promise.all([
    missingOpp.length ? db.from('opportunities').select('*').in('opportunity_id', missingOpp) : { data: [] },
    missingNews.length ? db.from('news_items').select('*').in('news_id', missingNews) : { data: [] },
    postIds.length ? db.from('feed_posts').select('post_id, headline, body').in('post_id', postIds) : { data: [] },
  ]);
  const posted = new Map((copy.data || []).map((p: any) => [p.post_id, p]));
  const decay = (at: Date) => Math.pow(0.5, Math.max(0, (now.getTime() - at.getTime()) / 86400_000) / HALF_LIFE_DAYS);

  const oppItems: FeedItem[] = [...(opps.data || []), ...(extraOpps.data || [])].map((o: Opportunity) => {
    const p = posted.get(`opp:${o.opportunity_id}`);
    const at = new Date(o.first_detected || o.publication_date || now);
    const score = o.opportunity_relevance_score ?? 30;
    return {
      key: `opp:${o.opportunity_id}`, kind: 'opportunity', event: 'new_opportunity',
      href: `/opportunities/${o.opportunity_id}`,
      headline: p?.headline || o.title, body: p ? p.body : o.summary,
      category: o.opportunity_type || 'rfp', categoryLabel: oppCategoryLabel(o.opportunity_type), kindLabel: 'Opportunity',
      country: o.country, at, score, combined: Math.round(score * decay(at)), movement: 'same',
      deadline: o.deadline, isNew: isNew(o, now), statusLabel: statusLabel(o, now),
    };
  });
  const newsItems: FeedItem[] = [...(news.data || []), ...(extraNews.data || [])].map((n: NewsItem) => {
    const p = posted.get(`news:${n.news_id}`);
    const at = new Date(n.published_date || n.created_at || now);
    const score = n.relevance_score ?? 30;
    return {
      key: `news:${n.news_id}`, kind: 'news', event: 'news', href: `/news/${n.news_id}`,
      headline: p?.headline || n.title, body: p ? p.body : n.summary || n.excerpt,
      category: n.category || 'market', categoryLabel: newsCategoryLabel(n.category), kindLabel: 'News',
      country: n.country, at, score, combined: Math.round(score * decay(at)), movement: 'same',
      deadline: null, isNew: now.getTime() - at.getTime() <= 2 * 86400_000,
    };
  });

  // Open opportunities first, then by the Top score; news by Top score.
  oppItems.sort((a, b) => Number(!!a.statusLabel) - Number(!!b.statusLabel) || b.combined - a.combined || b.score - a.score);
  newsItems.sort((a, b) => b.combined - a.combined || b.score - a.score);
  return { opportunities: oppItems, news: newsItems };
}
