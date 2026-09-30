import Link from 'next/link';
import { Opportunity, daysUntil, isNew, oppCategoryLabel } from '@/lib/data';

function priorityClass(score: number | null) {
  if (score === null) return '';
  return score >= 85 ? 'p0' : score >= 70 ? 'p1' : '';
}

export function DeadlineText({ deadline }: { deadline: string | null }) {
  if (!deadline) return <>Deadline not disclosed</>;
  const d = daysUntil(deadline);
  const date = new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <>
      Deadline {date}
      {d !== null && d >= 0 && <span className={d <= 14 ? 'due-soon' : ''}> · {d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} left`}</span>}
    </>
  );
}

export default function OpportunityCard({ o }: { o: Opportunity }) {
  return (
    <Link href={`/opportunities/${o.opportunity_id}`} className={`opp-card ${priorityClass(o.opportunity_relevance_score)}`}>
      <div className="opp-card-meta-row">
        <div>
          <div className="opp-card-country">{o.country || 'International'}{o.authority ? ` · ${o.authority}` : ''}</div>
          <div className="opp-tags">
            {isNew(o) && <span className="tag new">New</span>}
            {o.opportunity_type && <span className={`tag ${o.opportunity_type}`}>{oppCategoryLabel(o.opportunity_type)}</span>}
          </div>
        </div>
        <div className="opp-card-value">
          <span className="value-label">Value</span>
          {o.estimated_value ? `${o.currency || ''} ${o.estimated_value.toLocaleString()}` : 'Not disclosed'}
        </div>
      </div>
      <div className="opp-card-title">{o.title}</div>
      {o.summary && <div className="opp-card-summary">{o.summary}</div>}
      <div className="opp-card-scores">
        <div className="mini-score">
          <div className="mini-score-label">RELEVANCE <span className="mini-score-val">{o.opportunity_relevance_score ?? '—'}</span></div>
          <div className="mini-score-bar"><div className="mini-score-fill rel" style={{ width: `${o.opportunity_relevance_score ?? 0}%` }} /></div>
        </div>
        <div className="mini-score">
          <div className="mini-score-label">FIT <span className="mini-score-val">{o.bid_readiness_score ?? '—'}</span></div>
          <div className="mini-score-bar"><div className="mini-score-fill fit" style={{ width: `${o.bid_readiness_score ?? 0}%`, opacity: o.bid_readiness_score === null ? 0.3 : 1 }} /></div>
        </div>
      </div>
      <div className="opp-card-deadline"><DeadlineText deadline={o.deadline} /></div>
    </Link>
  );
}
