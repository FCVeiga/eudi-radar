/**
 * News Report Agent — runs only when a team member clicks "Trigger agent
 * report" on a news page. Reads the full article and reports what WalliD
 * should do about it: publish, participate, announce, reach out, bid, product
 * implications, or just monitor (prompt: agents/news_report.md; company
 * context: agents/company_brief.md — both team-editable).
 */
import { readFile } from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase';

export const AGENT_NAME = 'News Report Agent';
const MODEL = 'claude-opus-5-5';
const ACTION_TYPES = ['content', 'participate', 'announce', 'outreach', 'bid', 'product', 'monitor'];

async function systemPrompt() {
  const dir = path.join(process.cwd(), 'agents');
  const [prompt, brief] = await Promise.all([
    readFile(path.join(dir, 'news_report.md'), 'utf8'),
    readFile(path.join(dir, 'company_brief.md'), 'utf8'),
  ]);
  return prompt.replace('{company_brief}', brief);
}

/** Readable article text: Tavily's extractor when configured, else the page's HTML stripped. */
async function articleText(url: string) {
  const ctrl = AbortSignal.timeout(20_000);
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await fetch('https://api.tavily.com/extract', {
        method: 'POST', signal: ctrl, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
        body: JSON.stringify({ urls: [url] }),
      });
      const text = (await res.json())?.results?.[0]?.raw_content;
      if (text && text.length > 300) return String(text).slice(0, 20_000);
    } catch { /* fall back to the raw page */ }
  }
  const res = await fetch(url, { signal: ctrl, cache: 'no-store', headers: { 'User-Agent': 'EUDI-Radar/1.0 (+https://eudi-radar.vercel.app; news report)' } });
  const html = await res.text();
  return html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 20_000);
}

function parseJson(text: string) {
  const start = text.indexOf('{');
  for (let end = text.lastIndexOf('}'); end > start; end = text.lastIndexOf('}', end - 1)) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* try a shorter span */ }
  }
  throw new Error('The agent did not return a readable report.');
}

export async function runNewsReport(newsId: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
  const db = getSupabaseServerClient();
  const { data: n, error } = await db.from('news_items')
    .select('news_id, title, title_en, category, region, published_date, source_name, source_url, summary_long, summary')
    .eq('news_id', newsId).single();
  if (error || !n) throw new Error('News item not found.');

  let article = '';
  try { article = n.source_url ? await articleText(n.source_url) : ''; } catch { /* report from what we have */ }
  const story = [
    `Title: ${n.title_en || n.title}`, `Category: ${n.category}`, `Region: ${n.region}`,
    n.published_date && `Published: ${String(n.published_date).slice(0, 10)}`, `Source: ${n.source_name}`,
    (n.summary_long || n.summary) && `Our summary: ${n.summary_long || n.summary}`,
  ].filter(Boolean).join('\n');

  const client = new Anthropic({
    defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : undefined,
  });
  // Opus 5.5: thinking is always on and effort is the dial; the server-side
  // fallback re-runs a declined request on a fallback model.
  const response: any = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: await systemPrompt(),
    messages: [{ role: 'user', content: `${story}\n\nArticle text:\n${article || '(not available)'}` }],
    betas: ['server-side-fallback-2026-07-01'],
    output_config: { effort: 'medium' },
    fallbacks: 'default',
  } as any);
  if (response.stop_reason === 'refusal') throw new Error('The agent declined to report on this story.');
  const text = (response.content as any[]).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const out = parseJson(text);

  const report = {
    agent: AGENT_NAME,
    verdict: ['act', 'consider', 'monitor'].includes(out.verdict) ? out.verdict : 'monitor',
    take: String(out.take || '').trim(),
    actions: (Array.isArray(out.actions) ? out.actions : [])
      .filter((a: any) => a && ACTION_TYPES.includes(a.type) && a.title).slice(0, 6),
    model: response.model ?? MODEL,
  };
  const { error: saveError } = await db.from('news_items')
    .update({ analysis: report, analysed_at: new Date().toISOString() }).eq('news_id', newsId);
  if (saveError) throw new Error(saveError.message);
  return report;
}
