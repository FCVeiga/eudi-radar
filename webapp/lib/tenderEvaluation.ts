/**
 * Tender Evaluation Agent — per scope, run from a tender's page with a button.
 * Reads the tender (the Tender Analysis Agent's summary and requirements,
 * plus the award criteria) against the scope's instructions and context
 * documents, and writes — for that scope — a match status for each
 * requirement, a fit score and a bid report (scope_evaluations).
 * (prompt: agents/tender_evaluation.md, or the scope's fine-tuned version.)
 */
import { complete } from '@/lib/llm';
import { getSupabaseServerClient } from '@/lib/supabase';
import { agentPrompt, companyBrief, isAgentEnabled } from '@/lib/settings';
import { friendly, lockRow, unlockRow } from '@/lib/scopeWork';

export const EVALUATION_AGENT = 'Tender Evaluation Agent';
const MATCHES = ['MATCH', 'PARTIAL_MATCH', 'PARTNER_NEEDED', 'NO_MATCH', 'UNKNOWN'];
const VERDICTS = ['bid', 'bid_with_partner', 'consider', 'no_bid'];
// A run that started longer ago than this is presumed dead and may be retried.
const LOCK_MINUTES = 5;

export type EvaluationStatus = 'done' | 'running' | 'error';

// Its fine-tuned prompt from Settings (or agents/tender_evaluation.md), with the company's
// context and uploaded material in place of {company_brief}.
async function systemPrompt(scopeId: string) {
  const [prompt, brief] = await Promise.all([agentPrompt('tender_evaluation', 'tender_evaluation.md', scopeId), companyBrief({ withDocuments: true, scopeId })]);
  return prompt.replace('{company_brief}', brief);
}

function parseJson(text: string) {
  const start = text.indexOf('{');
  for (let end = text.lastIndexOf('}'); end > start; end = text.lastIndexOf('}', end - 1)) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* try a shorter span */ }
  }
  throw new Error('The agent did not return a readable report.');
}

/**
 * Run the evaluation unless one is already running (two clicks, or two
 * people, share one run: the second gets 'running' and waits for the page).
 */
export async function ensureEvaluation(opportunityId: string, scopeId: string): Promise<{ status: EvaluationStatus; message?: string }> {
  if (!(await isAgentEnabled('tender_evaluation', scopeId))) return { status: 'error', message: 'the Tender Evaluation Agent is switched off for this scope' };
  const key = { scope_id: scopeId, opportunity_id: opportunityId };
  if (!(await lockRow('scope_evaluations', key, 'evaluation_started_at', 'evaluation_error', LOCK_MINUTES))) return { status: 'running' };
  try {
    await runEvaluation(opportunityId, scopeId);
    await unlockRow('scope_evaluations', key, 'evaluation_started_at', 'evaluation_error', null);
    return { status: 'done' };
  } catch (e: any) {
    const message = friendly(e);
    await unlockRow('scope_evaluations', key, 'evaluation_started_at', 'evaluation_error', message);
    return { status: 'error', message };
  }
}

async function runEvaluation(opportunityId: string, scopeId: string) {
  const db = getSupabaseServerClient();
  const [{ data: o }, { data: reqs }, { data: award }] = await Promise.all([
    db.from('opportunities').select('*').eq('opportunity_id', opportunityId).single(),
    db.from('requirements').select('requirement_id, requirement_group, category, requirement_text, mandatory, threshold, evidence_required')
      .eq('opportunity_id', opportunityId),
    db.from('award_criteria').select('criterion, weight, subcriteria').eq('opportunity_id', opportunityId),
  ]);
  if (!o) throw new Error('Tender not found.');
  if (!o.tender_summary && !(reqs || []).length) {
    throw new Error('the Tender Analysis Agent has not read this tender yet');
  }

  // Short ids keep the prompt and the answer compact.
  const ids = new Map<string, string>();
  const reqLines = (reqs || []).map((r: any, i: number) => {
    ids.set(`R${i + 1}`, r.requirement_id);
    return `R${i + 1} [${r.requirement_group || r.category}${r.mandatory ? ', mandatory' : ', optional'}] ${r.requirement_text}`
      + (r.threshold ? ` — threshold: ${r.threshold}` : '') + (r.evidence_required ? ` — evidence: ${r.evidence_required}` : '');
  });
  const tender = [
    `Title: ${o.title_en || o.title}`, `Buyer: ${o.authority_en || o.authority || 'unknown'} (${o.country || 'international'})`,
    o.estimated_value && `Value: ${o.currency || ''} ${o.estimated_value}`, o.deadline && `Deadline: ${String(o.deadline).slice(0, 10)}`,
    `\nSummary:\n${o.tender_summary || o.summary || '(none)'}`,
    `\nAward criteria:\n${(award || []).map((a: any) => `- ${a.criterion} ${a.weight ?? '?'}%: ${a.subcriteria?.name_en || a.subcriteria?.name || ''} ${a.subcriteria?.description_en || ''}`).join('\n') || '(none)'}`,
    `\nRequirements:\n${reqLines.join('\n') || '(none extracted)'}`,
  ].filter(Boolean).join('\n');

  const response = await complete({
    system: await systemPrompt(scopeId),
    user: tender,
    maxTokens: 16000,
    effort: 'medium',
  });
  if (!response.text.trim()) throw new Error('The agent declined to evaluate this tender.');
  const out = parseJson(response.text);

  const matches = (Array.isArray(out.matches) ? out.matches : [])
    .filter((m: any) => ids.has(m?.id))
    .map((m: any) => ({
      requirement_id: ids.get(m.id)!, scope_id: scopeId,
      match_status: MATCHES.includes(String(m.match).toUpperCase()) ? String(m.match).toUpperCase() : 'UNKNOWN',
      notes: m.note ? String(m.note).slice(0, 1000) : null,
    }));
  const reqIds = Array.from(ids.values());
  if (reqIds.length) {
    const { error } = await db.from('requirement_matches').delete().eq('scope_id', scopeId).in('requirement_id', reqIds);
    if (error) throw new Error(error.message);
  }
  if (matches.length) {
    const { error } = await db.from('requirement_matches').insert(matches);
    if (error) throw new Error(error.message);
  }

  const fit = Math.max(0, Math.min(100, Math.round(Number(out.fit_score) || 0)));
  const list = (x: any) => (Array.isArray(x) ? x : []);
  const evaluation = {
    agent: EVALUATION_AGENT,
    fit_score: fit,
    verdict: VERDICTS.includes(out.verdict) ? out.verdict : 'consider',
    take: String(out.take || '').trim(),
    strengths: list(out.strengths).map(String).slice(0, 8),
    gaps: list(out.gaps).map(String).slice(0, 10),
    partners: list(out.partners).filter((p: any) => p?.role).slice(0, 6),
    next_steps: list(out.next_steps).filter((s: any) => s?.title).slice(0, 8),
    model: response.model,
  };
  const { error } = await db.from('scope_evaluations').update({
    evaluation, evaluated_at: new Date().toISOString(), evaluation_error: null,
  }).match({ scope_id: scopeId, opportunity_id: opportunityId });
  if (error) throw new Error(error.message);
}
