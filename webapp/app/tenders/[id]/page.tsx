import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { Opportunity, buyerOf, oppCategoryLabel, titleOf } from '@/lib/data';
import { firstInLanguage } from '@/lib/english';
import { DeadlineText, StatusTags } from '@/components/OpportunityCard';
import UpdateComment, { UpdateEvent } from '@/components/UpdateComment';
import TenderDocuments, { Doc } from '@/components/TenderDocuments';
import AgentAvatar from '@/components/AgentAvatar';
import { isAgentEnabled } from '@/lib/settings';
import TenderEvaluationRunner from '@/components/TenderEvaluationRunner';
import ProposalRunner from '@/components/ProposalRunner';
import HeartButton from '@/components/HeartButton';
import { getLikes } from '@/lib/likes';
import { getCurrentUser } from '@/lib/auth';
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

  const reqs = (requirements || []).filter((r) => firstInLanguage(r.requirement_text));
  const evaluated = reqs.some((r) => r.requirement_matches?.length);
  const evaluation = o.evaluation as Evaluation | null;
  const summary = (firstInLanguage(o.tender_summary) ?? firstInLanguage(o.summary) ?? '')
    .split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean);
  const [evaluatorOn, proposerOn, likes, user] = await Promise.all([
    isAgentEnabled('tender_evaluation'), isAgentEnabled('proposal_manager'), getLikes('tender', [o.opportunity_id]), getCurrentUser(),
  ]);
  const loginToRun = (agent: string) => (
    <p className="muted"><Link href={`/login?next=/tenders/${o.opportunity_id}`}>Log in</Link> to run the {agent}.</p>
  );
  const proposing = !!o.proposal_started_at && Date.now() - new Date(o.proposal_started_at).getTime() < 6 * 60_000;
  const running = !!o.evaluation_started_at && Date.now() - new Date(o.evaluation_started_at).getTime() < 5 * 60_000;

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
        <div className="stat"><div className="stat-label">Relevance</div><div className="stat-num">{o.opportunity_relevance_score ?? '—'}</div></div>
        <div className="stat"><div className="stat-label">Fit</div><div className="stat-num">{evaluation?.fit_score ?? '—'}</div></div>
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

          <section className="detail-block analysis-block" id="evaluation">
            <div className="agent-head">
              <AgentAvatar agent="tender_evaluation" working={running} off={!evaluatorOn} />
              <div className="agent-id">
                <h2>Tender Evaluation</h2>
                <span className="agent-name">Tender Evaluation Agent{o.evaluated_at ? ` · report from ${fmtDate(o.evaluated_at)}` : ''}</span>
              </div>
              {evaluation && <span className={`verdict eval-${evaluation.verdict}`}>{VERDICTS[evaluation.verdict] ?? evaluation.verdict}</span>}
            </div>
            {!evaluation && (
              <p className="agent-intro">
                Checks every requirement of this tender against WalliD&apos;s profile, scores the fit and recommends whether to bid.
              </p>
            )}
            {evaluation && o.tender_analysed_at && o.evaluated_at && o.tender_analysed_at > o.evaluated_at && (
              <p className="summary-note">The requirements were updated after this report (new tender documents) — re-run the evaluation.</p>
            )}
            {evaluation && (
              <div className="eval-report">
                <div className="eval-score"><span className="eval-score-num">{evaluation.fit_score}</span><span className="eval-score-label">Fit score</span></div>
                {firstInLanguage(evaluation.take) && <p className="analysis-take">{evaluation.take}</p>}
                <div className="eval-cols">
                  {evaluation.strengths.length > 0 && (
                    <div><h3>Strengths</h3><ul>{evaluation.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  )}
                  {evaluation.gaps.length > 0 && (
                    <div><h3>Gaps &amp; to confirm</h3><ul>{evaluation.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  )}
                </div>
                {evaluation.partners.length > 0 && (
                  <div><h3>Partners needed</h3><ul>{evaluation.partners.map((p, i) => <li key={i}><strong>{p.role}</strong>{p.why ? ` — ${p.why}` : ''}</li>)}</ul></div>
                )}
                {evaluation.next_steps.length > 0 && (
                  <div><h3>Next steps</h3><ul>{evaluation.next_steps.map((n, i) => (
                    <li key={i}>{n.title}{n.deadline ? <span className="action-deadline"> by {fmtDate(n.deadline)}</span> : null}</li>
                  ))}</ul></div>
                )}
              </div>
            )}
            {!evaluatorOn ? <p className="muted">The Tender Evaluation Agent is switched off in Settings.</p> : !user ? loginToRun('Tender Evaluation Agent') : <TenderEvaluationRunner opportunityId={o.opportunity_id} evaluatedAt={o.evaluated_at ?? null} running={running}
                              ready={!!o.tender_summary || reqs.length > 0} lastError={o.evaluation_error ?? null} />}

            {evaluation && proposerOn && (
              <div className="proposal-block" id="proposal">
                <div className="agent-head">
                  <AgentAvatar agent="proposal_manager" size={36} working={proposing} />
                  <div className="agent-id">
                    <h3>Proposal Manager Agent</h3>
                    <span className="agent-name">{o.proposal_at ? `Proposal brief from ${fmtDate(o.proposal_at)}` : 'Next step after the evaluation'}</span>
                  </div>
                </div>
                <p className="agent-intro">
                  Writes the proposal brief for the bid team: the tender summary, deadlines and evaluation criteria; every
                  eligibility, reference, team, technical and project requirement with the answer your company material
                  supports (who fills each role, which references and certificates); the documents to submit; the gaps
                  and the next steps.
                </p>
                {user ? <ProposalRunner opportunityId={o.opportunity_id} proposalAt={o.proposal_at ?? null} running={proposing}
                                lastError={o.proposal_error ?? null} /> : loginToRun('Proposal Manager Agent')}
              </div>
            )}
          </section>
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
            <h2>{evaluated ? <>Requirements &amp; Match Status</> : 'Requirements'} {reqs.length > 0 && <span className="uc-count">{reqs.length}</span>}</h2>
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
                  <thead><tr><th>Requirement</th><th>Threshold</th><th>Mandatory</th>{evaluated && <th>Match</th>}</tr></thead>
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
                        {evaluated && (
                          <td>
                            <span className={`badge-match ${matchClass(r.requirement_matches?.[0]?.match_status)}`}>
                              {matchLabel(r.requirement_matches?.[0]?.match_status)}
                            </span>
                            {r.requirement_matches?.[0]?.notes && <div className="req-match-note">{r.requirement_matches[0].notes}</div>}
                          </td>
                        )}
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
