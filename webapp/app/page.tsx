import Link from 'next/link';
import { FEED_VIEWS, FeedView, getFeed } from '@/lib/feed';
import { getActivity } from '@/lib/accounts';
import FeedCard from '@/components/FeedCard';
import LiveActivity from '@/components/LiveActivity';

const PAGE = 30;

// 16px line icons for the sort pills.
const VIEW_ICONS: Record<FeedView, JSX.Element> = {
  top: <path d="M8 1.5c.4 2.3 3.5 3.7 3.5 7.2A3.5 3.5 0 0 1 8 12.2a3.5 3.5 0 0 1-3.5-3.5c0-1.3.6-2.2 1.3-2.9.1 1.1.6 1.8 1.4 2.1-.4-2.4.2-4.6.8-6.4z" />,
  relevance: <path d="M8 1.5l1.5 4 4 1.5-4 1.5L8 12.5l-1.5-4-4-1.5 4-1.5zM12.5 11l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />,
  new: <><circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2.2 1.6" /></>,
};

export default async function FeedPage({ searchParams }: { searchParams: { view?: string; n?: string } }) {
  const now = new Date();
  const view = (FEED_VIEWS.find((v) => v.slug === searchParams.view)?.slug ?? 'top') as FeedView;
  const [{ items, error }, activity] = await Promise.all([getFeed(view, now), getActivity(30)]);
  const shown = Math.max(PAGE, Number(searchParams.n) || PAGE);
  const href = (v: FeedView, n?: number) => {
    const p = new URLSearchParams();
    if (v !== 'top') p.set('view', v);
    if (n) p.set('n', String(n));
    const q = p.toString();
    return q ? `/?${q}` : '/';
  };

  // Grid: the sort bar sits above the feed column only, so the Live activity
  // panel lines up with the first post card.
  return (
    <div className="home-layout">
      <nav className="feed-sort" aria-label="Sort the feed">
        {FEED_VIEWS.map((v) => (
          <Link key={v.slug} href={href(v.slug)} className={`feed-sort-link ${v.slug === view ? 'active' : ''}`}
                aria-current={v.slug === view ? 'page' : undefined}>
            <svg className="feed-sort-icon" viewBox="0 0 16 16" aria-hidden="true">{VIEW_ICONS[v.slug]}</svg>
            {v.label}
          </Link>
        ))}
      </nav>

      <div className="feed-page">
        {error && <div className="callout error"><strong>Error loading the feed.</strong> {error.message}</div>}
        {!error && items.length === 0 && <div className="callout">Nothing here yet.</div>}
        <div className="feed">
          {items.slice(0, shown).map((item) => (
            <FeedCard key={item.key} item={item} now={now} value={view === 'relevance' ? item.score : item.combined} />
          ))}
        </div>
        {items.length > shown && (
          <Link href={href(view, shown + PAGE)} scroll={false} className="feed-more">
            Show more <span className="mono">({items.length - shown} left)</span>
          </Link>
        )}
      </div>

      <aside className="home-right"><LiveActivity initial={activity} /></aside>
    </div>
  );
}
