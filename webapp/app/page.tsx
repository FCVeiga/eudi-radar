import Link from 'next/link';
import { daysUntil } from '@/lib/data';
import { FEED_VIEWS, FeedItem, FeedView, getFeed, timeAgo } from '@/lib/feed';

const PAGE = 30;

function Votes({ item }: { item: FeedItem }) {
  const title =
    item.movement === 'up' ? 'Moved up since the last update'
      : item.movement === 'down' ? 'Moved down since the last update' : 'No change in position';
  return (
    <div className={`feed-votes ${item.movement}`} title={`${title} · score ${item.combined} (AI ${item.score} × novelty)`}>
      <svg className="arrow up" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5 13 9.5H3z" /></svg>
      <span className="feed-votes-num">{item.combined}</span>
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

function FeedRow({ item, now }: { item: FeedItem; now: Date }) {
  return (
    <Link href={item.href} className={`feed-item ${item.kind}`}>
      <Votes item={item} />
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
  const view = (FEED_VIEWS.find((v) => v.slug === searchParams.view)?.slug ?? 'relevance') as FeedView;
  const { items, error } = await getFeed(view, now);
  const shown = Math.max(PAGE, Number(searchParams.n) || PAGE);
  const href = (v: FeedView, n?: number) => {
    const p = new URLSearchParams();
    if (v !== 'relevance') p.set('view', v);
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
            {v.label}
          </Link>
        ))}
      </nav>

      {error && <div className="callout error"><strong>Error loading the feed.</strong> {error.message}</div>}
      {!error && items.length === 0 && <div className="callout">Nothing here yet.</div>}

      <div className="feed">
        {items.slice(0, shown).map((item) => <FeedRow key={item.key} item={item} now={now} />)}
      </div>

      {items.length > shown && (
        <Link href={href(view, shown + PAGE)} scroll={false} className="feed-more">
          Show more <span className="mono">({items.length - shown} left)</span>
        </Link>
      )}
    </div>
  );
}
