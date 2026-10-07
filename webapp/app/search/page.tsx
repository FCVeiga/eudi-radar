import FeedCard from '@/components/FeedCard';
import { search, searchWords } from '@/lib/search';
import { getFeedLikes, likeTarget } from '@/lib/likes';

const likeOf = (likes: { signedIn: boolean; liked: Set<string> }, href: string) => {
  const t = likeTarget(href);
  return { liked: !!t && likes.liked.has(`${t[0]}:${t[1]}`), signedIn: likes.signedIn };
};

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q || '').trim();
  const now = new Date();
  const { opportunities, news } = await search(q, now);
  const likes = await getFeedLikes([...opportunities, ...news].map((i) => i.href));
  const total = opportunities.length + news.length;

  return (
    <div className="search-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Search</div>
          <h1>{q ? <>Results for “{q}”</> : 'Search'}</h1>
          <p className="page-sub">
            {!q ? 'Search tenders and news.'
              : !searchWords(q).length ? 'Use at least one word of two or more letters.'
                : `${total} result${total === 1 ? '' : 's'} — ${opportunities.length} tender${opportunities.length === 1 ? '' : 's'}, ${news.length} news.`}
          </p>
        </div>
      </div>

      {q && total === 0 && searchWords(q).length > 0 && (
        <div className="callout">Nothing matches every word. Try fewer or broader words.</div>
      )}

      {opportunities.length > 0 && (
        <section className="search-section">
          <h2 className="search-h2">Tenders <span className="mono">{opportunities.length}</span></h2>
          <div className="feed">{opportunities.map((i) => <FeedCard key={i.key} item={i} now={now} like={likeOf(likes, i.href)} />)}</div>
        </section>
      )}
      {news.length > 0 && (
        <section className="search-section">
          <h2 className="search-h2">News <span className="mono">{news.length}</span></h2>
          <div className="feed">{news.map((i) => <FeedCard key={i.key} item={i} now={now} like={likeOf(likes, i.href)} />)}</div>
        </section>
      )}
    </div>
  );
}
