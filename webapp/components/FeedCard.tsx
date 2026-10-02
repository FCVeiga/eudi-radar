import Link from 'next/link';
import { daysUntil } from '@/lib/data';
import { FeedItem, timeAgo } from '@/lib/feed';
import NewsImage from './NewsImage';

function Votes({ item, value }: { item: FeedItem; value: number }) {
  const title =
    item.movement === 'up' ? 'Moved up since the last update'
      : item.movement === 'down' ? 'Moved down since the last update' : 'No change in position';
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
  if (d < 0) return <div className="feed-foot">Closed {date}</div>;
  return (
    <div className={`feed-foot ${d <= 14 ? 'due-soon' : ''}`}>
      Deadline {date} · {d === 0 ? 'closes today' : `${d} day${d === 1 ? '' : 's'} left`}
    </div>
  );
}

/** One post: the same card on the home feed and in search results. */
export default function FeedCard({ item, now, value }: { item: FeedItem; now: Date; value?: number }) {
  return (
    <Link href={item.href} className={`feed-item ${item.kind}`}>
      <Votes item={item} value={value ?? item.combined} />
      <div className="feed-body">
        <div className="feed-meta">
          <span className={`feed-kind ${item.kind}`}>{item.kindLabel}</span>
          <span className={`tag ${item.category}`}>{item.categoryLabel}</span>
          {item.isNew && <span className="tag new">New</span>}
          {item.statusLabel && <span className="tag closed">{item.statusLabel}</span>}
          {item.country && <span className="feed-meta-text">{item.country}</span>}
          <span className="feed-time" title={item.at.toLocaleString('en-GB')}>{timeAgo(item.at, now)}</span>
        </div>
        <div className="feed-title">{item.headline}</div>
        {item.image && <NewsImage src={item.image} />}
        {item.body && <p className="feed-summary">{item.body}</p>}
        {item.deadline && <Deadline deadline={item.deadline} now={now} />}
      </div>
    </Link>
  );
}
