import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';

function priorityClass(score: number | null) {
  if (score === null) return '';
  return score >= 85 ? 'p0' : score >= 70 ? 'p1' : '';
}

export default async function OpportunitiesPage() {
  const supabase = getSupabaseServerClient();

  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('*')
    .gt('opportunity_relevance_score', 50)
    .order('opportunity_relevance_score', { ascending: false });

  if (error) {
    return (
      <div>
        <div className="hero"><div><h1>Opportunities</h1></div></div>
        <div className="detail-block">
          <h2>Error loading opportunities</h2>
          <p>{error.message}</p>
          <p>Check that SUPABASE_URL / SUPABASE_SERVICE_KEY are set correctly
             and that database/supabase_migration.sql has been run against
             this project.</p>
        </div>
      </div>
    );
  }

  const qualifying = (opportunities || []).filter(
    (o) => o.bid_readiness_score === null || o.bid_readiness_score > 50
  );

  return (
    <div>
      <div className="hero">
        <div>
          <h1>Opportunities</h1>
          <div className="hero-sub">Relevance &gt; 50% and Fit &gt; 50% only</div>
        </div>
      </div>

      {qualifying.length === 0 && (
        <div className="sample-note">
          <strong>No qualifying opportunities yet.</strong> Either the daily
          pipeline hasn't run yet, or nothing has cleared the relevance/fit
          threshold. Check the Database page for the full unfiltered list.
        </div>
      )}

      <div className="opp-grid">
        {qualifying.map((o) => (
          <Link
            key={o.opportunity_id}
            href={`/opportunities/${o.opportunity_id}`}
            className={`opp-card ${priorityClass(o.opportunity_relevance_score)}`}
          >
            <div className="opp-card-meta-row">
              <div>
                <div className="opp-card-country">{o.country || o.authority}</div>
                <div className="opp-tags">
                  {o.opportunity_type && <span className={`tag ${o.opportunity_type.toLowerCase()}`}>{o.opportunity_type}</span>}
                </div>
              </div>
              <div className="opp-card-value">
                <span className="value-label">Value</span>
                {o.estimated_value ? `${o.currency || ''} ${o.estimated_value.toLocaleString()}` : 'Not disclosed'}
              </div>
            </div>
            <div className="opp-card-title">{o.title}</div>
            <div className="opp-card-scores">
              <div className="mini-score">
                <div className="mini-score-label">RELEVANCE <span className="mini-score-val">{o.opportunity_relevance_score}</span></div>
                <div className="mini-score-bar"><div className="mini-score-fill rel" style={{ width: `${o.opportunity_relevance_score}%` }} /></div>
              </div>
              <div className="mini-score">
                <div className="mini-score-label">FIT <span className="mini-score-val">{o.bid_readiness_score ?? '—'}</span></div>
                <div className="mini-score-bar"><div className="mini-score-fill fit" style={{ width: `${o.bid_readiness_score ?? 0}%`, opacity: o.bid_readiness_score === null ? 0.3 : 1 }} /></div>
              </div>
            </div>
            <div className="opp-card-deadline">
              Deadline {o.deadline ? new Date(o.deadline).toLocaleDateString() : 'Not disclosed'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
