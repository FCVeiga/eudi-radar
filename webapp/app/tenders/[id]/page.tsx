import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { Opportunity, buyerOf, oppCategoryLabel, titleOf } from '@/lib/data';
import { firstInLanguage } from '@/lib/english';
import { DeadlineText, StatusTags } from '@/components/OpportunityCard';
import UpdateComment, { UpdateEvent } from '@/components/UpdateComment';
import TenderDocuments, { Doc } from '@/components/TenderDocuments';
import AgentAvatar from '@/components/AgentAvatar';
import { isAgentEnabled } from '@/lib/settings';
import HeartButton from '@/components/HeartButton';
import { getLikes } from '@/lib/likes';
import { getCurrentUser } from '@/lib/auth';
import { getScopeItems, getViewScopes } from '@/lib/scopes';
import TenderScopeEvaluation from '@/components/TenderScopeEvaluation';
import { getPlatformLanguage } from '@/lib/language';

// The Tender Evaluation Agent runs inside this page's server action: give it time.
export const maxDuration = 300;

// The Tender Analysis Agent's four groups; older rows without a group fall back on their category.
const REQ_GROUPS: { key: string; label: string; categories: string[] }[] = [
  { key: 'ELIGIBILITY', label: 'Eligibility criteria',
    categories: ['LEGAL', 'FINANCIAL', 'TURNOVER', 'INSURANCE', 'CERTIFICATION', 'LOCAL_PRESENCE', 'CONSORTIUM', 'SUBCONTRACTING', 'EVIDENCE'] },
  { key: 'REFERENCES', label: 'Project references', categories: ['REFERENCE', 'COMPANY_EXPERIENCE'] },
  { key: 'HUMAN_RESOURCES', label: 'Human resource requirements',
    categories: ['TEAM', 'CV', 'EDUCATION', 'PERSONAL_CERTIFICATION', 'SECURITY_CLEARANCE', 'LANGUAGE', 'FTE'] },
  { key: 'TECHNICAL', label: 'Technical & project requirements',
    categories: ['TECHNICAL', 'SECURITY', 'PRIVACY', 'EIDAS', 'EUDI', 'INTEROPERABILITY', 'HOSTING', 'SLA', 'IMPLEMENTATION'] },
];
const groupOf = (r: any) => r.requirement_group
  || REQ_GROUPS.find((g) => g.categories.includes(r.category))?.key || 'TECHNICAL';

type Evaluation = {
  fit_score: number; verdict: string; take?: string; strengths: string[]; gaps: string[];
  partners: { role: string; why?: string }[]; next_steps: { title: string; deadline?: string | null }[];
};
const VERDICTS: Record<string, string> = {
  bid: 'Bid', bid_with_partner: 'Bid with a partner', consider: 'Consider', no_bid: 'No bid',
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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
  await getPlatformLanguage();  // the display filter's language
  const supabase = getSupabaseServerClient();

  const { data: o, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('opportunity_id', params.id)
    .single();

  if (error || !o) {
    return (
      <div>
        <Link className="back-link" href="/tenders">← Back to Tenders</Link>
        <div className="detail-block"><h2>Not found</h2><p>{error?.message || 'No tender with this ID.'}</p></div>
      </div>
    );
  }

  const { data: requirements } = await supabase
    .from('requirements')
    .select('*, requirement_matches(match_status, matched_evidence, notes, scope_id)')
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

  const reqs = (requirements || []).filter((r) => firstInLanguage(r.requirement_text));
  // Scopes: the viewer's active scopes (or the default scope): relevance, evaluations, match columns.
  const { scopes: viewScopes, own } = await getViewScopes();
  const { data: scopeEvals } = await supabase.from('scope_evaluations').select('*').eq('opportunity_id', params.id)
    .in('scope_id', viewScopes.map((s) => s.id));
  const evalOf = (scopeId: string) => (scopeEvals || []).find((r: any) => r.scope_id === scopeId) ?? null;
  const evaluatedScopes = viewScopes.filter((s) => evalOf(s.id)?.evaluation);
  const scopeItems = await getScopeItems('tender');
  const relevance = scopeItems?.relevance.get(params.id) ?? o.opportunity_relevance_score;
  const fits = evaluatedScopes.map((s) => evalOf(s.id).evaluation.fit_score as number);
  const matchOf = (r: any, scopeId: string) => (r.requirement_matches || []).find((m: any) => m.scope_id === scopeId);
  const summary = (firstInLanguage(o.tender_summary) ?? firstInLanguage(o.summary) ?? '')
    .split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean);
  const [likes, user, agentFlags] = await Promise.all([
    getLikes('tender', [o.opportunity_id]), getCurrentUser(),
    Promise.all(viewScopes.map(async (s) => [s.id, await isAgentEnabled('tender_evaluation', s.id), await isAgentEnabled('proposal_manager', s.id)] as const)),
  ]);
  const flags = new Map(agentFlags.map(([id, e, p]) => [id, { evaluator: e, proposer: p }]));

  return (
    <div>
      <Link className="back-link" href="/tenders">← Tenders</Link>

      <div className="detail-head">
        <div className="detail-tags-row">
          <div className="opp-tags"><StatusTags o={o as Opportunity} /></div>
          <HeartButton type="tender" id={o.opportunity_id} liked={likes.liked.has(o.opportunity_id)} signedIn={likes.signedIn} className="page-heart" />
        </div>
        <h1>{titleOf(o)}</h1>
        <p className="page-sub">{[buyerOf(o), o.country].filter(Boolean).join(' · ') || 'International'}</p>
        {titleOf(o) !== o.title && (
          <p className="original-title"><span>Original{o.language ? ` (${o.language.toUpperCase()})` : ''}</span> {o.title}</p>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Relevance</div><div className="stat-num">{relevance ?? '—'}</div></div>
        <div className="stat"><div className="stat-label">Fit</div><div className="stat-num">{fits.length ? Math.max(...fits) : '—'}</div></div>
        <div className="stat"><div className="stat-label">Value</div><div className="stat-num small">{o.estimated_value ? `${o.currency || ''} ${o.estimated_value.toLocaleString()}` : 'Not disclosed'}</div></div>
        <div className="stat"><div className="stat-label">Deadline</div><div className="stat-num small"><DeadlineText deadline={o.deadline} /></div></div>
      </div>

      <div className="opp-detail-grid">
        <div>
          {summary.length > 0 && (
            <div className="detail-block">
              <h2>Summary</h2>
              {summary.map((p: string, i: number) => <p key={i}>{p}</p>)}
              {o.tender_summary
                ? <p className="summary-note">Tender Analysis Agent · from the notice and {o.official_url?.includes('ted.europa.eu') ? 'the tender documents' : 'the tender page'}</p>
                : <p className="summary-note">Short summary from triage — the Tender Analysis Agent replaces it with the full summary and the requirements.</p>}
            </div>
          )}

          {viewScopes.map((scope) => (
            <TenderScopeEvaluation key={scope.id} opportunityId={o.opportunity_id} scope={{ id: scope.id, name: scope.name }}
              row={evalOf(scope.id)} showName={viewScopes.length > 1 || !own} canRun={own} signedIn={!!user}
              evaluatorOn={flags.get(scope.id)?.evaluator ?? true} proposerOn={flags.get(scope.id)?.proposer ?? true}
              ready={!!o.tender_summary || reqs.length > 0} analysedAt={o.tender_analysed_at ?? null} />
          ))}
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
                  const what = firstInLanguage(a.subcriteria?.name_en, a.subcriteria?.name, a.subcriteria?.description_en, a.subcriteria?.description);
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

          <div className="detail-block" id="requirements">
            <h2>{evaluatedScopes.length ? <>Requirements &amp; Match Status</> : 'Requirements'} {reqs.length > 0 && <span className="uc-count">{reqs.length}</span>}</h2>
            {reqs.length === 0 ? (
              <p className="muted">
                {o.tender_analysed_at
                  ? 'The published documents state no requirements yet — the Tender Analysis Agent will list them when the buyer publishes the tender documents.'
                  : 'Pending — the Tender Analysis Agent writes the requirements (eligibility criteria, project references, human resources, technical & project requirements) together with the full summary, in the pipeline run that adds the tender.'}
              </p>
            ) : REQ_GROUPS.map((g) => ({ ...g, rows: reqs.filter((r) => groupOf(r) === g.key) })).filter((g) => g.rows.length).map((g) => (
              <div key={g.key} className="req-category-block">
                <div className="req-category-title">{g.label} <span className="uc-count">{g.rows.length}</span></div>
                <table className="req-table">
                  <thead><tr><th>Requirement</th><th>Threshold</th><th>Mandatory</th>{evaluatedScopes.map((sc) => <th key={sc.id}>{evaluatedScopes.length > 1 ? `Match · ${sc.name}` : 'Match'}</th>)}</tr></thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.requirement_id}>
                        <td>
                          {r.requirement_text}
                          {firstInLanguage(r.evidence_required) && <div className="req-evidence">Evidence: {r.evidence_required}</div>}
                          {r.document && <div className="req-source">{r.document}</div>}
                        </td>
                        <td>{firstInLanguage(r.threshold) ?? ''}</td>
                        <td>{r.mandatory ? <span className="mand-yes">Mandatory</span> : <span className="mand-no">Optional</span>}</td>
                        {evaluatedScopes.map((sc) => {
                          const m = matchOf(r, sc.id);
                          return (
                            <td key={sc.id}>
                              <span className={`badge-match ${matchClass(m?.match_status)}`}>{matchLabel(m?.match_status)}</span>
                              {m?.notes && <div className="req-match-note">{m.notes}</div>}
                            </td>
                          );
                        })}
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
