import { NEWS_CATEGORIES, getActiveOpportunities, getNews, newsCategoryLabel, titleOf } from '@/lib/data';
import { FeedItem, newsScore } from '@/lib/feed';
import { firstInLanguage } from '@/lib/english';
import { getSupabaseServerClient } from '@/lib/supabase';
import FeedCard from './FeedCard';
import SectionTabs from './SectionTabs';
import { getFeedLikes, likeTarget } from '@/lib/likes';

const likeOf = (likes: { signedIn: boolean; liked: Set<string> }, href: string) => {
  const t = likeTarget(href);
  return { liked: !!t && likes.liked.has(`${t[0]}:${t[1]}`), signedIn: likes.signedIn };
};

type View = 'all' | 'signals' | (typeof NEWS_CATEGORIES)[number]['slug'];

export default async function NewsView({ view }: { view: View }) {
  const now = new Date();
  const [{ news: all, error }, { opportunities: signals }] = await Promise.all([getNews(), getActiveOpportunities('signal')]);
  const heading = view === 'signals' ? { label: 'Signals' } : NEWS_CATEGORIES.find((c) => c.slug === view);

  // The agents' post for each story: substance-first English copy, and the
  // feed ranks behind the movement arrows.
  const { data: posts } = all.length
    ? await getSupabaseServerClient().from('feed_posts').select('post_id, headline, body, rank, prev_rank')
        .in('post_id', all.map((n) => `news:${n.news_id}`))
    : { data: [] as any[] };
  const post = new Map((posts || []).map((p: any) => [p.post_id.slice(5), p]));
  // Signals (a named buyer announced a procurement that isn't open yet) sit
  // with the news: their latest agent post, else the triage summary.
  const { data: signalPosts } = signals.length
    ? await getSupabaseServerClient().from('feed_posts').select('opportunity_id, headline, body, posted_at, rank, prev_rank')
        .in('opportunity_id', signals.map((o) => o.opportunity_id)).order('posted_at', { ascending: false })
    : { data: [] as any[] };
  const signalPost = new Map<string, any>();
  for (const p of signalPosts || []) if (!signalPost.has(p.opportunity_id)) signalPost.set(p.opportunity_id, p);
  const signalItems: FeedItem[] = signals.map((o): FeedItem => {
    const p = signalPost.get(o.opportunity_id);
    const at = new Date(o.publication_date || o.first_detected || now);
    const score = o.opportunity_relevance_score ?? 30;
    return {
      key: `signal:${o.opportunity_id}`, kind: 'opportunity', event: 'signal', href: `/tenders/${o.opportunity_id}`,
      headline: firstInLanguage(p?.headline) ?? titleOf(o), body: firstInLanguage(p?.body, o.summary),
      category: 'signal', categoryLabel: 'Signal', kindLabel: 'Planned procurement',
      country: o.country, at, score, combined: Math.round(newsScore(score, at, now)),
      movement: !p || p.rank == null ? 'same' : p.prev_rank == null || p.rank < p.prev_rank ? 'up' : p.rank > p.prev_rank ? 'down' : 'same',
      deadline: o.deadline, isNew: now.getTime() - at.getTime() <= 2 * 86400_000,
    };
  });

  const newsItems: FeedItem[] = all
    .filter((n) => view === 'all' || n.category === view)
    .map((n): FeedItem => {
      const p = post.get(n.news_id);
      const at = new Date(n.published_date || n.created_at || now);
      const score = n.relevance_score ?? 30;
      const movement: FeedItem['movement'] = !p || p.rank == null ? 'same'
        : p.prev_rank == null || p.rank < p.prev_rank ? 'up' : p.rank > p.prev_rank ? 'down' : 'same';
      return {
        key: n.news_id, kind: 'news', event: 'news', href: `/news/${n.news_id}`,
        headline: firstInLanguage(p?.headline) ?? titleOf(n),
        body: firstInLanguage(p?.body, n.summary),
        category: n.category || 'market', categoryLabel: newsCategoryLabel(n.category), kindLabel: 'News',
        country: n.region && n.region !== 'EU / International' ? n.region : null,
        at, score, combined: Math.round(newsScore(score, at, now)), movement,
        deadline: null, isNew: now.getTime() - at.getTime() <= 2 * 86400_000,
        image: n.image_url,
      };
    });
  const items = (view === 'signals' ? signalItems : view === 'all' ? [...newsItems, ...signalItems] : newsItems)
    .sort((a, b) => b.combined - a.combined || b.at.getTime() - a.at.getTime());

  const likes = await getFeedLikes(items.map((i) => i.href));
  const tabs = [
    { href: '/news', label: 'All', count: all.length + signals.length },
    ...NEWS_CATEGORIES.map((c) => ({
      href: `/news/${c.slug}`, label: c.label, count: all.filter((n) => n.category === c.slug).length,
    })),
    { href: '/news/signals', label: 'Signals', count: signals.length },
  ];

  return (
    <div className="news-page">
      <h1 className="opps-h1">{heading ? heading.label : 'EUDI News'}</h1>
      <SectionTabs tabs={tabs} active={view === 'all' ? '/news' : `/news/${view}`} />

      {error && <div className="callout error"><strong>Error loading news.</strong> {error.message}</div>}
      {!error && items.length === 0 && (
        <div className="callout">
          <strong>{view === 'signals' ? 'No confirmed signals right now.' : 'No news in this section yet.'}</strong>
          {view === 'signals' && ' A signal is a named buyer announcing a procurement that isn’t open yet — a prior information notice, an approved budget, a mandated system. They appear here, and on the home feed, once the pipeline has checked them against the source.'}
        </div>
      )}

      <div className="feed">
        {items.map((i) => <FeedCard key={i.key} item={i} now={now} like={likeOf(likes, i.href)} />)}
      </div>
    </div>
  );
}
