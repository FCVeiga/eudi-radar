import Link from 'next/link';
import { Opportunity, daysUntil, isNew, isUpdated, oppCategoryLabel } from '@/lib/data';
import UpdateComment, { UpdateEvent } from './UpdateComment';

export type RowCopy = { headline: string | null; body: string | null } | undefined;

/** Clean English title: triage's title_en, else the agent's headline without its event prefix. */
function titleFor(o: Opportunity, copy: RowCopy) {
  if (o.title_en) return o.title_en;
  const h = copy?.headline?.replace(/^(New (tender|RFI|grant|signal)|Signal|Deadline (extended|changed|brought forward)|Awarded):\s*/i, '');
  return h || o.title;
}

function money(value: number | null, currency: string | null) {
  if (!value) return null;
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'USD' ? '$' : `${currency ?? ''} `;
  if (value >= 1e9) return `${sym}${(value / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (value >= 1e6) return `${sym}${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1e3) return `${sym}${Math.round(value / 1e3)}K`;
  return `${sym}${value}`;
}

/** flagcdn uses ISO 3166 codes (gb, not uk) and has an EU flag. */
const flagCode = (c: string | null) => (!c ? 'eu' : c.toUpperCase() === 'UK' ? 'gb' : c.toLowerCase());

export function Ring({ value, label, gradient }: { value: number | null; label: string; gradient: string }) {
  const r = 24, c = 2 * Math.PI * r;
  const v = value == null ? null : Math.max(0, Math.min(100, value));
  return (
    <div className="ring" title={`${label}: ${v ?? 'not scored yet'}`}>
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r={r} className="ring-track" />
        {v != null && (
          <circle cx="30" cy="30" r={r} className="ring-value" stroke={`url(#${gradient})`}
                  strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 30 30)" />
        )}
      </svg>
      <span className={`ring-num ${v == null ? 'empty' : ''}`}>{v ?? '—'}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

/** Shared <defs> for the rings — render once per page. */
export function RingGradients() {
  return (
    <svg width="0" height="0" className="sr-only" aria-hidden="true">
      <defs>
        <linearGradient id="grad-rel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00CCFF" /><stop offset="1" stopColor="#00FFCC" /></linearGradient>
        <linearGradient id="grad-fit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6D5BFF" /><stop offset="1" stopColor="#00CCFF" /></linearGradient>
      </defs>
    </svg>
  );
}

export default function OpportunityRow({ o, copy, countryName, updates = [] }: {
  o: Opportunity; copy: RowCopy; countryName: string | null; updates?: UpdateEvent[];
}) {
  const days = daysUntil(o.deadline);
  const value = money(o.estimated_value, o.currency);
  const description = copy?.body || o.summary;
  const urgent = days != null && days <= 14;

  return (
    <Link href={`/opportunities/${o.opportunity_id}`} className="opp-row">
      <div className="opp-where">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="flag" src={`https://flagcdn.com/${flagCode(o.country)}.svg`} alt="" width={44} height={33} loading="lazy" />
        <span className="opp-country">{countryName ?? (o.country || 'EU / Intl')}</span>
      </div>

      <div className="opp-main">
        <div className="opp-tags">
          {isNew(o) && <span className="tag new">New</span>}
          {!isNew(o) && isUpdated(o) && <span className="tag updated">Updated</span>}
          {o.opportunity_type && <span className={`tag ${o.opportunity_type}`}>{oppCategoryLabel(o.opportunity_type)}</span>}
          {o.duration_months ? <span className="opp-chip">{o.duration_months >= 24 ? `${+(o.duration_months / 12).toFixed(1)} years` : `${o.duration_months} months`}</span> : null}
        </div>
        <h2 className="opp-title">{titleFor(o, copy)}</h2>
        {description && <p className="opp-desc">{description}</p>}
        {o.authority && <p className="opp-buyer"><span>Buyer</span>{o.authority}</p>}
      </div>

      <div className="opp-metrics">
        <Ring value={o.opportunity_relevance_score} label="Relevance" gradient="grad-rel" />
        <Ring value={o.bid_readiness_score} label="Fit" gradient="grad-fit" />
        <div className="metric value">
          <span className={`metric-big ${value ? 'shine' : 'muted'}`}>{value ?? 'n/d'}</span>
          <span className="metric-label">Value</span>
        </div>
        <div className={`metric deadline ${urgent ? 'urgent' : ''}`}>
          {days != null ? (
            <>
              <span className={`metric-big ${urgent ? 'shine-warm' : 'shine-ink'}`}>{days <= 0 ? 'Today' : `${days}d`}</span>
              <span className="metric-label">{new Date(o.deadline!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </>
          ) : (
            <>
              <span className="metric-big muted">{o.opportunity_type === 'signal' ? 'Soon' : 'Open'}</span>
              <span className="metric-label">No deadline</span>
            </>
          )}
        </div>
      </div>

      {updates.length > 0 && (
        <div className="opp-updates">
          <UpdateComment e={updates[0]} compact />
          {updates.length > 1 && <span className="uc-more">+{updates.length - 1} earlier update{updates.length > 2 ? 's' : ''}</span>}
        </div>
      )}
    </Link>
  );
}
