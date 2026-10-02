/**
 * Config Agent — the platform's internal agent that turns what people write
 * on the Settings page into configuration the other agents run on:
 *   - the search scope → TED phrases, web / news queries, site-search terms
 *     and the Triage Agent's relevance rules (used by the daily pipeline);
 *   - an agent's fine-tuning → a rewrite of that agent's prompt, with its
 *     output format and placeholders kept intact (checked here).
 * (prompts: agents/config_search.md, agents/config_tune.md)
 */
import { readFile } from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';

async function prompt(file: string) {
  return readFile(path.join(process.cwd(), 'agents', file), 'utf8');
}

async function ask(system: string, user: string, maxTokens: number) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
  const client = new Anthropic({
    defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : undefined,
  });
  const response: any = await client.beta.messages.create({
    model: MODEL, max_tokens: maxTokens, system,
    messages: [{ role: 'user', content: user }],
    betas: ['server-side-fallback-2026-07-01'],
    output_config: { effort: 'medium' },
    fallbacks: 'default',
  } as any);
  if (response.stop_reason === 'refusal') throw new Error('The Config Agent declined this request.');
  return (response.content as any[]).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

export function friendlyError(e: any) {
  const raw = String(e?.message || e);
  return /credit balance/i.test(raw) ? 'the Anthropic API account is out of credit' : raw.slice(0, 200);
}

const list = (x: any, max: number) => (Array.isArray(x) ? x.map(String).map((s) => s.trim()).filter(Boolean) : []).slice(0, max);

/** The search scope text → the search configuration (see agents/config_search.md). */
export async function parseSearchScope(scope: string, triageDefault: string) {
  const rules = [/<!-- scope -->([\s\S]*?)<!-- \/scope -->/, /<!-- importance -->([\s\S]*?)<!-- \/importance -->/]
    .map((re) => triageDefault.match(re)?.[1]?.trim() ?? '').join('\n\nImportance tiers:\n');
  const system = (await prompt('config_search.md')).replace('{example_rules}', rules);
  const text = await ask(system, `Search scope written by the user:\n\n${scope}`, 16000);
  const start = text.indexOf('{');
  const out = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  const config = {
    topic: String(out.topic || '').slice(0, 80),
    ted_phrases: list(out.ted_phrases, 100),
    local_phrases: Object.fromEntries(Object.entries(out.local_phrases || {})
      .filter(([k]) => /^[a-z]{2}$/.test(k)).map(([k, v]) => [k, list(v, 4)])),
    web_queries: list(out.web_queries, 80),
    news_queries: list(out.news_queries, 15),
    site_query: String(out.site_query || '').slice(0, 200),
    relevance_rubric: String(out.relevance_rubric || ''),
    importance_rubric: String(out.importance_rubric || ''),
  };
  if (config.ted_phrases.length < 5 || !config.web_queries.length || !config.relevance_rubric.includes('## Task')) {
    throw new Error('the Config Agent returned an incomplete configuration — try describing the scope in more detail');
  }
  return config;
}

const PLACEHOLDERS = ['{company_brief}', '{company_name}', '{topic}', '<!-- scope -->', '<!-- /scope -->', '<!-- importance -->', '<!-- /importance -->'];
// The "## Output" section alone (up to the next heading): the format the code parses.
const outputSection = (p: string) => {
  const rest = p.slice(p.indexOf('## Output'));
  const next = rest.indexOf('\n## ', 3);
  return next < 0 ? rest : rest.slice(0, next);
};

/** An agent's default prompt + the user's fine-tuning → the agent's new prompt. */
export async function tunePrompt(agentName: string, role: string, defaultPrompt: string, instructions: string) {
  const text = await ask(await prompt('config_tune.md'),
    `Agent: ${agentName} — ${role}\n\nThe user's fine-tuning:\n${instructions}\n\nDEFAULT prompt:\n<default>\n${defaultPrompt}\n</default>`, 16000);
  const next = text.match(/<prompt>\s*([\s\S]*?)\s*<\/prompt>/)?.[1];
  const note = text.match(/<note>\s*([\s\S]*?)\s*<\/note>/)?.[1]?.trim() ?? null;
  if (!next) throw new Error('the Config Agent did not return a prompt');
  const lost = PLACEHOLDERS.filter((p) => defaultPrompt.includes(p) && !next.includes(p));
  if (lost.length) throw new Error(`the rewrite dropped ${lost.join(', ')} — not applied`);
  if (defaultPrompt.includes('## Output') && outputSection(next).trim() !== outputSection(defaultPrompt).trim()) {
    throw new Error('the rewrite changed the agent’s output format — not applied');
  }
  return { prompt: next, note };
}
