import Link from 'next/link';
import { daysUntil } from '@/lib/data';
import { FEED_VIEWS, FeedItem, FeedView, getFeed, timeAgo } from '@/lib/feed';

const PAGE = 30;

// 16px line icons for the sort pills.
const VIEW_ICONS: Record<FeedView, JSX.Element> = {
  top: <path d="M8 1.5c.4 2.3 3.5 3.7 3.5 7.2A3.5 3.5 0 0 1 8 12.2a3.5 3.5 0 0 1-3.5-3.5c0-1.3.6-2.2 1.3-2.9.1 1.1.6 1.8 1.4 2.1-.4-2.4.2-4.6.8-6.4z" />,
  relevance: <path d="M8 1.5l1.5 4 4 1.5-4 1.5L8 12.5l-1.5-4-4-1.5 4-1.5zM12.5 11l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />,
  new: <><circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2.2 1.6" /></>,
};

function Votes({ item, view }: { item: FeedItem; view: FeedView }) {
  const title =
    item.movement === 'up' ? 'Moved up since the last update'
      : item.movement === 'down' ? 'Moved down since the last update' : 'No change in position';
  // Show the score the current view sorts by.
  const value = view === 'relevance' ? item.score : item.combined;
  return (
    <div className={`feed-votes ${item.movement}`} title={`${title} · AI relevance ${item.score}, top score ${item.combined}`}>
      <svg className="arrow up" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5 13 9.5H3z" /></svg>
      <span className="feed-votes-num">{value}</span>
      <svg className="arrow down" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5 3 6.5h10z" /></svg>
    </div>
  );
}

function Deadline({ deadline, now }: { deadline: string; now: Date }) {
  const d = daysUntil(deadline, now)!;
  const date = new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className={`feed-foot ${d <= 14 ? 'due-soon' : ''}`}>
      Deadline {date} · {d <= 0 ? 'closes today' : `${d} day${d === 1 ? '' : 's'} left`}
    </div>
  );
}

function FeedRow({ item, now, view }: { item: FeedItem; now: Date; view: FeedView }) {
  return (
    <Link href={item.href} className={`feed-item ${item.kind}`}>
      <Votes item={item} view={view} />
      <div className="feed-body">
        <div className="feed-meta">
          <span className={`feed-kind ${item.kind}`}>{item.kindLabel}</span>
          <span className={`tag ${item.category}`}>{item.categoryLabel}</span>
          {item.isNew && <span className="tag new">New</span>}
          {item.country && <span className="feed-meta-text">{item.country}</span>}
          <span className="feed-time" title={item.at.toLocaleString('en-GB')}>{timeAgo(item.at, now)}</span>
        </div>
        <div className="feed-title">{item.headline}</div>
        {item.body && <p className="feed-summary">{item.body}</p>}
        {item.deadline && <Deadline deadline={item.deadline} now={now} />}
      </div>
    </Link>
  );
}

export default async function FeedPage({ searchParams }: { searchParams: { view?: string; n?: string } }) {
  const now = new Date();
  const view = (FEED_VIEWS.find((v) => v.slug === searchParams.view)?.slug ?? 'top') as FeedView;
  const { items, error } = await getFeed(view, now);
  const shown = Math.max(PAGE, Number(searchParams.n) || PAGE);
  const href = (v: FeedView, n?: number) => {
    const p = new URLSearchParams();
    if (v !== 'top') p.set('view', v);
    if (n) p.set('n', String(n));
    const q = p.toString();
    return q ? `/?${q}` : '/';
  };

  return (
    <div className="feed-page">
      <h1 className="feed-h1">EUDI Radar</h1>

      <nav className="feed-sort" aria-label="Sort and filter the feed">
        {FEED_VIEWS.map((v) => (
          <Link key={v.slug} href={href(v.slug)} className={`feed-sort-link ${v.slug === view ? 'active' : ''}`}
                aria-current={v.slug === view ? 'page' : undefined}>
            <svg className="feed-sort-icon" viewBox="0 0 16 16" aria-hidden="true">{VIEW_ICONS[v.slug]}</svg>
            {v.label}
          </Link>
        ))}
      </nav>

      {error && <div className="callout error"><strong>Error loading the feed.</strong> {error.message}</div>}
      {!error && items.length === 0 && <div className="callout">Nothing here yet.</div>}

      <div className="feed">
        {items.slice(0, shown).map((item) => <FeedRow key={item.key} item={item} now={now} view={view} />)}
      </div>

      {items.length > shown && (
        <Link href={href(view, shown + PAGE)} scroll={false} className="feed-more">
          Show more <span className="mono">({items.length - shown} left)</span>
        </Link>
      )}
    </div>
  );
}
