/**
 * News Report Agent — per scope, runs the first time a story's page is opened
 * for that scope.
 * Reads the full article and writes, in one go, the page's complete summary
 * (with key facts) and its report on what the scope's team should do: publish,
 * participate, announce, reach out, bid, product implications, or monitor.
 * The result is saved, so later visits show it instantly.
 * (prompt: agents/news_report.md; company context: agents/company_brief.md.)
 */
import { complete } from '@/lib/llm';
import { getSupabaseServerClient } from '@/lib/supabase';
import { agentPrompt, companyBrief, isAgentEnabled } from '@/lib/settings';
import { friendly, lockRow, unlockRow } from '@/lib/scopeWork';

export const AGENT_NAME = 'News Report Agent';
const ACTION_TYPES = ['content', 'participate', 'announce', 'outreach', 'bid', 'product', 'monitor'];

// Its fine-tuned prompt from Settings (or agents/news_report.md), with the company's
// context in place of {company_brief}.
async function systemPrompt(scopeId: string) {
  const [prompt, brief] = await Promise.all([agentPrompt('news_report', 'news_report.md', scopeId), companyBrief({ withDocuments: false, scopeId })]);
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
  const res = await fetch(url, { signal: ctrl, cache: 'no-store', headers: { 'User-Agent': 'TenderTown/1.0 (+https://tender-town.vercel.app; news report)' } });
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

// A run that started longer ago than this is presumed dead and may be retried.
const LOCK_MINUTES = 5;

export type ReportStatus = 'done' | 'running' | 'error';

/**
 * Make sure the story has its summary and, for this scope, its report. Takes
 * a lock first, so when two people open the same story only one run happens
 * per scope; the other gets 'running' and waits for the page to fill in.
 */
export async function ensureNewsReport(newsId: string, scopeId: string): Promise<{ status: ReportStatus; message?: string }> {
  if (!(await isAgentEnabled('news_report', scopeId))) return { status: 'error', message: 'the News Report Agent is switched off for this scope' };
  const db = getSupabaseServerClient();
  const key = { scope_id: scopeId, news_id: newsId };
  const { data: existing } = await db.from('scope_news_reports').select('analysed_at').match(key).maybeSingle();
  if (existing?.analysed_at) return { status: 'done' };
  if (!(await lockRow('scope_news_reports', key, 'started_at', 'error', LOCK_MINUTES))) return { status: 'running' };
  try {
    await runNewsReport(newsId, scopeId);
    await unlockRow('scope_news_reports', key, 'started_at', 'error', null);
    return { status: 'done' };
  } catch (e: any) {
    const message = friendly(e);
    // Release the lock so the next visit tries again.
    await unlockRow('scope_news_reports', key, 'started_at', 'error', message);
    return { status: 'error', message };
  }
}

async function runNewsReport(newsId: string, scopeId: string) {
  const db = getSupabaseServerClient();
  const { data: n, error } = await db.from('news_items')
    .select('news_id, title, title_en, category, region, published_date, source_name, source_url, summary')
    .eq('news_id', newsId).single();
  if (error || !n) throw new Error('News item not found.');

  let article = '';
  try { article = n.source_url ? await articleText(n.source_url) : ''; } catch { /* report from what we have */ }
  const story = [
    `Title: ${n.title_en || n.title}`, `Category: ${n.category}`, `Region: ${n.region}`,
    n.published_date && `Published: ${String(n.published_date).slice(0, 10)}`, `Source: ${n.source_name}`,
    n.summary && `Short summary from triage: ${n.summary}`,
  ].filter(Boolean).join('\n');

  const response = await complete({
    system: await systemPrompt(scopeId),
    user: `${story}\n\nArticle text:\n${article || '(not available — work from the facts above)'}`,
    maxTokens: 12000,
    effort: 'medium',
  });
  if (!response.text.trim()) throw new Error('The agent declined to report on this story.');
  const out = parseJson(response.text);

  const report = {
    agent: AGENT_NAME,
    verdict: ['act', 'consider', 'monitor'].includes(out.verdict) ? out.verdict : 'monitor',
    take: String(out.take || '').trim(),
    actions: (Array.isArray(out.actions) ? out.actions : [])
      .filter((a: any) => a && ACTION_TYPES.includes(a.type) && a.title).slice(0, 6),
    model: response.model,
  };
  // The summary describes the story (shared by every scope); the report is this scope's.
  const summary = String(out.summary || '').trim();
  if (summary) {
    await db.from('news_items').update({
      summary_long: summary, key_facts: (Array.isArray(out.key_facts) ? out.key_facts : []).map(String).slice(0, 8), analysed_at: new Date().toISOString(),
    }).eq('news_id', newsId);
  }
  const { error: saveError } = await db.from('scope_news_reports').update({ analysis: report, analysed_at: new Date().toISOString(), error: null })
    .match({ scope_id: scopeId, news_id: newsId });
  if (saveError) throw new Error(saveError.message);
}
