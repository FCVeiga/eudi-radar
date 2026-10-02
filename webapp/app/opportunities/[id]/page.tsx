import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { Opportunity, buyerOf, oppCategoryLabel, titleOf } from '@/lib/data';
import { firstEnglish } from '@/lib/english';
import { DeadlineText, StatusTags } from '@/components/OpportunityCard';
import UpdateComment, { UpdateEvent } from '@/components/UpdateComment';
import TenderDocuments, { Doc } from '@/components/TenderDocuments';

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
  if (m === 'PARTIAL_MATCH') return 'Partial';
  return 'Unknown';
}
function matchClass(m: string | null) {
  if (m === 'MATCH') return 'match';
  if (m === 'PARTNER_NEEDED') return 'partner';
  if (m === 'NO_MATCH') return 'no_match';
  if (m === 'PARTIAL_MATCH') return 'partner';
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
    .select('*, requirement_matches(match_status, matched_evidence, notes)')
    .eq('opportunity_id', params.id);

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('opportunity_id', params.id)
    .order('publication_date', { ascending: true, nullsFirst: false });

  const { data: award } = await supabase
    .from('award_criteria')
    .select('*')
    .eq('opportunity_id', params.id)
    .order('weight', { ascending: false });

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
        <h1>{titleOf(o)}</h1>
        <p className="page-sub">{[buyerOf(o), o.country].filter(Boolean).join(' · ') || 'International'}</p>
        {titleOf(o) !== o.title && (
          <p className="original-title"><span>Original{o.language ? ` (${o.language.toUpperCase()})` : ''}</span> {o.title}</p>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Relevance</div><div className="stat-num">{o.opportunity_relevance_score ?? '—'}</div></div>
        <div className="stat"><div className="stat-label">Fit</div><div className="stat-num">{o.bid_readiness_score ?? '—'}</div></div>
        <div className="stat"><div className="stat-label">Value</div><div className="stat-num small">{o.estimated_value ? `${o.currency || ''} ${o.estimated_value.toLocaleString()}` : 'Not disclosed'}</div></div>
        <div className="stat"><div className="stat-label">Deadline</div><div className="stat-num small"><DeadlineText deadline={o.deadline} /></div></div>
      </div>

      <div className="opp-detail-grid">
        <div>
          {firstEnglish(o.summary) && <div className="detail-block"><h2>Summary</h2><p>{o.summary}</p></div>}
          {changes && changes.length > 0 && (
            <div className="detail-block" id="updates">
              <h2>Updates <span className="uc-count">{changes.length}</span></h2>
              <div className="uc-thread">
                {(changes as UpdateEvent[]).map((c) => <UpdateComment key={c.id} e={c} />)}
              </div>
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

          {(award || []).length > 0 && (
            <div className="detail-block">
              <h2>Award criteria</h2>
              <div className="award-list">
                {(award || []).map((a: any) => {
                  const what = firstEnglish(a.subcriteria?.name_en, a.subcriteria?.name, a.subcriteria?.description_en, a.subcriteria?.description);
                  return (
                    <div key={a.id} className="award-row">
                      <span className="award-label">{a.criterion}{what ? <em> — {what}</em> : null}</span>
                      <span className="award-bar"><span style={{ width: `${a.weight ?? 0}%` }} /></span>
                      <span className="award-weight">{a.weight != null ? `${a.weight}%` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="detail-block">
            <h2>Requirements &amp; Match Status</h2>
            {(requirements || []).length === 0 ? (
              <p className="muted">
                Not extracted yet. The Tender Analysis agent reads the notice&apos;s selection criteria and tenderer
                requirements — certifications, references, team, insurance, technical obligations — and checks each
                against WalliD&apos;s profile. It runs in the daily pipeline for open tenders.
              </p>
            ) : Object.entries(reqsByCategory).filter(([, rows]) => rows.length).map(([label, rows]) => (
              <div key={label} className="req-category-block">
                <div className="req-category-title">{label}</div>
                <table className="req-table">
                  <thead><tr><th>Requirement</th><th>Threshold</th><th>Mandatory</th><th>Match</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.requirement_id}>
                        <td>{firstEnglish(r.requirement_text) ?? '—'}{firstEnglish(r.evidence_required) && <div className="req-evidence">Evidence: {r.evidence_required}</div>}</td>
                        <td>{firstEnglish(r.threshold) ?? ''}</td>
                        <td>{r.mandatory ? <span className="mand-yes">Mandatory</span> : <span className="mand-no">Optional</span>}</td>
                        <td>
                          <span className={`badge-match ${matchClass(r.requirement_matches?.[0]?.match_status)}`}
                                title={r.requirement_matches?.[0]?.notes ?? ''}>
                            {matchLabel(r.requirement_matches?.[0]?.match_status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>

        <TenderDocuments docs={(documents || []) as Doc[]} />
      </div>
    </div>
  );
}
