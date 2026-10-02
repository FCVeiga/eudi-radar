/**
 * Proposal Manager Agent — run from the tender page's evaluation section,
 * once the Tender Evaluation Agent has reported. Writes the proposal brief
 * (Markdown): tender summary, deadlines, evaluation criteria, every
 * requirement with the answer the company's material supports, the
 * documents to submit, the gaps and the next steps.
 * (prompt: agents/proposal_manager.md; company material: Settings.)
 */
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase';
import { agentPrompt, companyBrief, isAgentEnabled } from '@/lib/settings';

const MODEL = 'claude-opus-5-5';
const LOCK_MINUTES = 6;
const GROUPS: Record<string, string> = {
  ELIGIBILITY: 'Eligibility', REFERENCES: 'Project references', HUMAN_RESOURCES: 'Human resources', TECHNICAL: 'Technical & project',
};

export type ProposalStatus = 'done' | 'running' | 'error';

export async function ensureProposal(opportunityId: string): Promise<{ status: ProposalStatus; message?: string }> {
  if (!(await isAgentEnabled('proposal_manager'))) return { status: 'error', message: 'the Proposal Manager Agent is switched off in Settings' };
  const db = getSupabaseServerClient();
  const cutoff = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  const { data: locked } = await db.from('opportunities')
    .update({ proposal_started_at: new Date().toISOString(), proposal_error: null })
    .eq('opportunity_id', opportunityId)
    .or(`proposal_started_at.is.null,proposal_started_at.lt.${cutoff}`)
    .select('opportunity_id');
  if (!locked?.length) return { status: 'running' };
  try {
    await runProposal(opportunityId);
    await db.from('opportunities').update({ proposal_started_at: null }).eq('opportunity_id', opportunityId);
    return { status: 'done' };
  } catch (e: any) {
    const raw = String(e?.message || e);
    const message = /credit balance/i.test(raw) ? 'the Anthropic API account is out of credit' : raw.slice(0, 200);
    await db.from('opportunities').update({ proposal_started_at: null, proposal_error: message }).eq('opportunity_id', opportunityId);
    return { status: 'error', message };
  }
}

async function runProposal(opportunityId: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
  const db = getSupabaseServerClient();
  const [{ data: o }, { data: reqs }, { data: award }, { data: docs }] = await Promise.all([
    db.from('opportunities').select('*').eq('opportunity_id', opportunityId).single(),
    db.from('requirements').select('requirement_group, category, requirement_text, mandatory, threshold, evidence_required, document, requirement_matches(match_status, notes)')
      .eq('opportunity_id', opportunityId),
    db.from('award_criteria').select('criterion, weight, subcriteria').eq('opportunity_id', opportunityId).order('weight', { ascending: false }),
    db.from('documents').select('name, name_en, document_type').eq('opportunity_id', opportunityId),
  ]);
  if (!o) throw new Error('Tender not found.');
  if (!o.evaluation) throw new Error('run the Tender Evaluation Agent first');

  const ev = o.evaluation;
  const title = o.title_en || o.title;
  const reqLines = (reqs || []).map((r: any, i: number) => {
    const m = r.requirement_matches?.[0];
    return `R${i + 1} [${GROUPS[r.requirement_group] ?? r.category}${r.mandatory ? ', mandatory' : ', optional'}] ${r.requirement_text}`
      + (r.threshold ? ` — threshold: ${r.threshold}` : '') + (r.evidence_required ? ` — evidence: ${r.evidence_required}` : '')
      + (r.document ? ` — source: ${r.document}` : '') + (m ? ` — evaluation: ${m.match_status}${m.notes ? ` (${m.notes})` : ''}` : '');
  });
  const tender = [
    `Title: ${title}`, `Buyer: ${o.authority_en || o.authority || 'unknown'} (${o.country || 'international'})`,
    `Value: ${o.estimated_value ? `${o.currency || ''} ${o.estimated_value}` : 'not disclosed'}`,
    `Submission deadline: ${o.deadline ? String(o.deadline).slice(0, 10) : 'not stated'}`,
    `Official notice: ${o.official_url || '—'}`,
    `\nTender summary:\n${o.tender_summary || o.summary || '(none)'}`,
    `\nAward criteria:\n${(award || []).map((a: any) => `- ${a.criterion} ${a.weight ?? '?'}%: ${a.subcriteria?.name_en || a.subcriteria?.name || ''} ${a.subcriteria?.description_en || a.subcriteria?.description || ''}`).join('\n') || '(none published)'}`,
    `\nRequirements:\n${reqLines.join('\n') || '(none extracted)'}`,
    `\nEvaluation report: fit ${ev.fit_score}/100, verdict ${ev.verdict}. ${ev.take || ''}`,
    ev.strengths?.length && `Strengths:\n${ev.strengths.map((s: string) => `- ${s}`).join('\n')}`,
    ev.gaps?.length && `Gaps:\n${ev.gaps.map((s: string) => `- ${s}`).join('\n')}`,
    ev.partners?.length && `Partners:\n${ev.partners.map((p: any) => `- ${p.role}: ${p.why || ''}`).join('\n')}`,
    `\nPublished tender documents:\n${(docs || []).map((d: any) => `- [${d.document_type}] ${d.name_en || d.name}`).join('\n') || '(none listed)'}`,
  ].filter(Boolean).join('\n');

  const [prompt, brief] = await Promise.all([agentPrompt('proposal_manager', 'proposal_manager.md'), companyBrief({ withDocuments: true })]);
  const client = new Anthropic({
    defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : undefined,
  });
  // A long document: stream it, so the request isn't held to the non-streaming time limit.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 24000,
    system: prompt.replace('{company_brief}', brief).replaceAll('{tender title}', title),
    messages: [{ role: 'user', content: tender }],
    betas: ['server-side-fallback-2026-07-01'],
    output_config: { effort: 'medium' },
    fallbacks: 'default',
  } as any);
  const response: any = await stream.finalMessage();
  if (response.stop_reason === 'refusal') throw new Error('The agent declined to write this brief.');
  let markdown = (response.content as any[]).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  markdown = markdown.replace(/^```(?:markdown|md)?\s*\n/, '').replace(/\n```\s*$/, '');
  if (!markdown.startsWith('#')) throw new Error('The agent did not return a brief.');
  if (response.stop_reason === 'max_tokens') markdown += '\n\n> _The brief was cut short at the length limit — re-run to regenerate it._\n';

  const { error } = await db.from('opportunities').update({
    proposal_brief: markdown, proposal_at: new Date().toISOString(), proposal_error: null,
  }).eq('opportunity_id', opportunityId);
  if (error) throw new Error(error.message);
}
