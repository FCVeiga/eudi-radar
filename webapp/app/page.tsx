import Link from 'next/link';
import { daysUntil } from '@/lib/data';
import { FeedItem, HALF_LIFE_DAYS, getFeed, timeAgo } from '@/lib/feed';

const PAGE = 30;

function ScoreColumn({ score }: { score: number }) {
  return (
    <div className="feed-score" title="AI relevance score (0–100)">
      <span className="feed-score-num">{score}</span>
      <span className="feed-score-meter"><span style={{ height: `${score}%` }} /></span>
    </div>
  );
}

function Foot({ item, now }: { item: FeedItem; now: Date }) {
  if (item.update) return <div className="feed-foot update">↻ {item.update}</div>;
  if (item.kind === 'opportunity') {
    if (!item.deadline) return <div className="feed-foot">No deadline stated</div>;
    const d = daysUntil(item.deadline, now)!;
    const date = new Date(item.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return (
      <div className={`feed-foot ${d <= 14 ? 'due-soon' : ''}`}>
        Deadline {date} · {d === 0 ? 'closes today' : `${d} day${d === 1 ? '' : 's'} left`}
      </div>
    );
  }
  return null;
}

function FeedRow({ item, now }: { item: FeedItem; now: Date }) {
  return (
    <Link href={item.href} className={`feed-item ${item.kind}`}>
      <ScoreColumn score={item.score} />
      <div className="feed-body">
        <div className="feed-meta">
          <span className={`feed-kind ${item.kind}`}>{item.kindLabel}</span>
          <span className={`tag ${item.category}`}>{item.categoryLabel}</span>
          {item.isNew && <span className="tag new">New</span>}
          {item.country && <span className="feed-meta-text">{item.country}</span>}
          {item.source && <span className="feed-meta-text source">{item.source}</span>}
          <span className="feed-time" title={item.at.toLocaleString('en-GB')}>{timeAgo(item.at, now)}</span>
        </div>
        <div className="feed-title">{item.title}</div>
        {item.summary && <p className="feed-summary">{item.summary}</p>}
        <Foot item={item} now={now} />
      </div>
    </Link>
  );
}

export default async function FeedPage({ searchParams }: { searchParams: { n?: string } }) {
  const now = new Date();
  const { items, error } = await getFeed(now);
  const shown = Math.max(PAGE, Number(searchParams.n) || PAGE);

  return (
    <div className="feed-page">
      <div className="feed-head">
        <h1>Feed</h1>
        <p className="page-sub">
          Opportunities and news in one stream, ranked by AI relevance and recency — an item&apos;s weight halves every {HALF_LIFE_DAYS} days.
        </p>
      </div>

      {error && <div className="callout error"><strong>Error loading the feed.</strong> {error.message}</div>}
      {!error && items.length === 0 && <div className="callout">Nothing in the feed yet.</div>}

      <div className="feed">
        {items.slice(0, shown).map((item) => <FeedRow key={item.key} item={item} now={now} />)}
      </div>

      {items.length > shown && (
        <Link href={`/?n=${shown + PAGE}`} scroll={false} className="feed-more">
          Show more <span className="mono">({items.length - shown} left)</span>
        </Link>
      )}
    </div>
  );
}
