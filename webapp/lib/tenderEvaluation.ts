/**
 * Tender Evaluation Agent — run from an opportunity's page with a button.
 * Reads the tender (the Tender Analysis Agent's summary and requirements,
 * plus the award criteria) against the company brief, and writes a match
 * status for each requirement, a fit score and a bid report.
 * (prompt: agents/tender_evaluation.md; company context: agents/company_brief.md.)
 */
import { readFile } from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase';

export const EVALUATION_AGENT = 'Tender Evaluation Agent';
const MODEL = 'claude-opus-5-5';
const MATCHES = ['MATCH', 'PARTIAL_MATCH', 'PARTNER_NEEDED', 'NO_MATCH', 'UNKNOWN'];
const VERDICTS = ['bid', 'bid_with_partner', 'consider', 'no_bid'];
// A run that started longer ago than this is presumed dead and may be retried.
const LOCK_MINUTES = 5;

export type EvaluationStatus = 'done' | 'running' | 'error';

async function systemPrompt() {
  const dir = path.join(process.cwd(), 'agents');
  const [prompt, brief] = await Promise.all([
    readFile(path.join(dir, 'tender_evaluation.md'), 'utf8'),
    readFile(path.join(dir, 'company_brief.md'), 'utf8'),
  ]);
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
export async function ensureEvaluation(opportunityId: string): Promise<{ status: EvaluationStatus; message?: string }> {
  const db = getSupabaseServerClient();
  const cutoff = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  const { data: locked } = await db.from('opportunities')
    .update({ evaluation_started_at: new Date().toISOString(), evaluation_error: null })
    .eq('opportunity_id', opportunityId)
    .or(`evaluation_started_at.is.null,evaluation_started_at.lt.${cutoff}`)
    .select('opportunity_id');
  if (!locked?.length) return { status: 'running' };
  try {
    await runEvaluation(opportunityId);
    await db.from('opportunities').update({ evaluation_started_at: null }).eq('opportunity_id', opportunityId);
    return { status: 'done' };
  } catch (e: any) {
    const raw = String(e?.message || e);
    const message = /credit balance/i.test(raw) ? 'the Anthropic API account is out of credit' : raw.slice(0, 200);
    await db.from('opportunities').update({ evaluation_started_at: null, evaluation_error: message }).eq('opportunity_id', opportunityId);
    return { status: 'error', message };
  }
}

async function runEvaluation(opportunityId: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
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

  const client = new Anthropic({
    defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : undefined,
  });
  const response: any = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: await systemPrompt(),
    messages: [{ role: 'user', content: tender }],
    betas: ['server-side-fallback-2026-07-01'],
    output_config: { effort: 'medium' },
    fallbacks: 'default',
  } as any);
  if (response.stop_reason === 'refusal') throw new Error('The agent declined to evaluate this tender.');
  const out = parseJson((response.content as any[]).filter((b) => b.type === 'text').map((b) => b.text).join(''));

  const matches = (Array.isArray(out.matches) ? out.matches : [])
    .filter((m: any) => ids.has(m?.id))
    .map((m: any) => ({
      requirement_id: ids.get(m.id)!,
      match_status: MATCHES.includes(String(m.match).toUpperCase()) ? String(m.match).toUpperCase() : 'UNKNOWN',
      notes: m.note ? String(m.note).slice(0, 1000) : null,
    }));
  const reqIds = Array.from(ids.values());
  if (reqIds.length) {
    const { error } = await db.from('requirement_matches').delete().in('requirement_id', reqIds);
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
    model: response.model ?? MODEL,
  };
  const { error } = await db.from('opportunities').update({
    evaluation, evaluated_at: new Date().toISOString(), evaluation_error: null, bid_readiness_score: fit,
  }).eq('opportunity_id', opportunityId);
  if (error) throw new Error(error.message);
}
