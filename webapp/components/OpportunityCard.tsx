import Link from 'next/link';
import { Opportunity, buyerOf, daysUntil, isNew, isUpdated, oppCategoryLabel, titleOf } from '@/lib/data';

export function DeadlineText({ deadline }: { deadline: string | null }) {
  if (!deadline) return <>No deadline stated</>;
  const d = daysUntil(deadline);
  const date = new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <>
      {date}
      {d !== null && d >= 0 && (
        <span className={`countdown ${d <= 14 ? 'due-soon' : ''}`}>{d === 0 ? 'today' : `${d}d left`}</span>
      )}
    </>
  );
}

export function StatusTags({ o }: { o: Opportunity }) {
  return (
    <>
      {isNew(o) && <span className="tag new">New</span>}
      {!isNew(o) && isUpdated(o) && <span className="tag updated">Updated</span>}
      {o.opportunity_type && <span className={`tag ${o.opportunity_type}`}>{oppCategoryLabel(o.opportunity_type)}</span>}
    </>
  );
}

export function ScoreBar({ label, value, kind }: { label: string; value: number | null; kind: 'rel' | 'fit' }) {
  return (
    <div className="mini-score">
      <div className="mini-score-label">{label}<span className="mini-score-val">{value ?? '—'}</span></div>
      <div className="mini-score-bar">
        <div className={`mini-score-fill ${kind}`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

export default function OpportunityCard({ o }: { o: Opportunity }) {
  return (
    <Link href={`/opportunities/${o.opportunity_id}`} className="opp-card">
      <div className="opp-card-top">
        <div className="opp-tags"><StatusTags o={o} /></div>
        {o.country && <span className="country-chip">{o.country}</span>}
      </div>
      <div className="opp-card-title">{titleOf(o)}</div>
      {buyerOf(o) && <div className="opp-card-authority">{buyerOf(o)}</div>}
      {o.summary && <div className="opp-card-summary">{o.summary}</div>}
      <div className="opp-card-scores">
        <ScoreBar label="Relevance" value={o.opportunity_relevance_score} kind="rel" />
        <ScoreBar label="Fit" value={o.bid_readiness_score} kind="fit" />
      </div>
      <div className="opp-card-foot">
        <span className="foot-label">Deadline</span>
        <span className="opp-card-deadline"><DeadlineText deadline={o.deadline} /></span>
        <span className="opp-card-value">
          {o.estimated_value ? `${o.currency || ''} ${o.estimated_value.toLocaleString()}` : 'Value n/d'}
        </span>
      </div>
    </Link>
  );
}
