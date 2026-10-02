import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { Opportunity, oppCategoryLabel } from '@/lib/data';
import { DeadlineText, StatusTags } from '@/components/OpportunityCard';

const REQ_CATEGORY_GROUPS: Record<string, string[]> = {
  Certifications: ['CERTIFICATION', 'PERSONAL_CERTIFICATION'],
  'Project References': ['REFERENCE', 'COMPANY_EXPERIENCE'],
  'Human Resources': ['TEAM', 'CV', 'EDUCATION', 'FTE', 'LANGUAGE', 'SECURITY_CLEARANCE'],
  Technical: ['TECHNICAL', 'SECURITY', 'PRIVACY', 'EIDAS', 'EUDI', 'INTEROPERABILITY', 'HOSTING'],
  Other: ['LEGAL', 'FINANCIAL', 'TURNOVER', 'INSURANCE', 'LOCAL_PRESENCE', 'SLA',
          'IMPLEMENTATION', 'CONSORTIUM', 'SUBCONTRACTING', 'EVIDENCE', 'AWARD'],
};

function matchLabel(m: string | null) {
  if (m === 'MATCH') return 'Match';
  if (m === 'PARTNER_NEEDED') return 'Partner needed';
  if (m === 'NO_MATCH') return 'No match';
  return 'Unknown';
}
function matchClass(m: string | null) {
  if (m === 'MATCH') return 'match';
  if (m === 'PARTNER_NEEDED') return 'partner';
  if (m === 'NO_MATCH') return 'no_match';
  return 'unknown';
}

export default async function OpportunityDetailPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient();

  const { data: o, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('opportunity_id', params.id)
    .single();

  if (error || !o) {
    return (
      <div>
        <Link className="back-link" href="/opportunities">← Back to Opportunities</Link>
        <div className="detail-block"><h2>Not found</h2><p>{error?.message || 'No opportunity with this ID.'}</p></div>
      </div>
    );
  }

  const { data: requirements } = await supabase
    .from('requirements')
    .select('*, requirement_matches(match_status, matched_evidence)')
    .eq('opportunity_id', params.id);

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('opportunity_id', params.id);

  const { data: changes } = await supabase
    .from('change_events')
    .select('*')
    .eq('opportunity_id', params.id)
    .order('detected_at', { ascending: false });

  const reqsByCategory: Record<string, any[]> = {};
  for (const groupName of Object.keys(REQ_CATEGORY_GROUPS)) {
    reqsByCategory[groupName] = (requirements || []).filter((r) =>
      REQ_CATEGORY_GROUPS[groupName].includes(r.category)
    );
  }

  return (
    <div>
      <Link className="back-link" href="/opportunities">← Opportunities</Link>

      <div className="detail-head">
        <div className="opp-tags"><StatusTags o={o as Opportunity} /></div>
        <h1>{o.title}</h1>
        <p className="page-sub">{[o.authority, o.country].filter(Boolean).join(' · ') || 'International'}</p>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Relevance</div><div className="stat-num">{o.opportunity_relevance_score ?? '—'}</div></div>
        <div className="stat"><div className="stat-label">Fit</div><div className="stat-num">{o.bid_readiness_score ?? '—'}</div></div>
        <div className="stat"><div className="stat-label">Value</div><div className="stat-num small">{o.estimated_value ? `${o.currency || ''} ${o.estimated_value.toLocaleString()}` : 'Not disclosed'}</div></div>
        <div className="stat"><div className="stat-label">Deadline</div><div className="stat-num small"><DeadlineText deadline={o.deadline} /></div></div>
      </div>

      <div className="opp-detail-grid">
        <div>
          {o.summary && <div className="detail-block"><h2>Summary</h2><p>{o.summary}</p></div>}
          {changes && changes.length > 0 && (
            <div className="detail-block">
              <h2>Updates</h2>
              {changes.map((c) => (
                <div key={c.id} className="change-row">
                  <span className="date-badge">{new Date(c.detected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span>{c.description}</span>
                </div>
              ))}
            </div>
          )}
          <div className="detail-block">
            <h2>Status</h2>
            <p>{oppCategoryLabel(o.opportunity_type)} — {o.status}</p>
            {o.status_evidence && <p className="evidence">{o.status_evidence}</p>}
            {o.verified_at && (
              <p className="news-meta">Checked against the source on {new Date(o.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            )}
          </div>
          <div className="detail-block">
            <h2>Source</h2>
            {o.official_url
              ? <p><a className="ext-link" href={o.official_url} target="_blank" rel="noopener noreferrer">{o.official_url} ↗</a></p>
              : <p className="mono">Not recorded</p>}
          </div>

          <div className="detail-block">
            <h2>Requirements &amp; Match Status</h2>
            {Object.entries(reqsByCategory).map(([label, rows]) => (
              <div key={label} className="req-category-block">
                <div className="req-category-title">{label}</div>
                {rows.length === 0 ? (
                  <div className="req-empty">No {label.toLowerCase()} requirements identified in this opportunity.</div>
                ) : (
                  <table className="req-table">
                    <thead><tr><th>Requirement</th><th>Threshold</th><th>Mandatory</th><th>Match</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.requirement_id}>
                          <td>{r.requirement_text}</td>
                          <td>{r.threshold}</td>
                          <td>{r.mandatory ? <span className="mand-yes">Mandatory</span> : <span className="mand-no">Optional</span>}</td>
                          <td>
                            <span className={`badge-match ${matchClass(r.requirement_matches?.[0]?.match_status)}`}>
                              {matchLabel(r.requirement_matches?.[0]?.match_status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="opp-sidebar">
          <h3>Tender Documents</h3>
          <div className="sidebar-sub">{(documents || []).length} document(s) on file</div>
          {(documents || []).map((d) => (
            <div key={d.document_id} className="doc-item">
              <div>
                <div>{d.name}</div>
                <div className="doc-type">{d.document_type?.replace(/_/g, ' ')}</div>
              </div>
              {d.url && <a className="doc-download" href={d.url} target="_blank" rel="noopener noreferrer">Download ↓</a>}
            </div>
          ))}
          {(!documents || documents.length === 0) && (
            <div className="sidebar-sub">No documents recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
