import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { newsCategoryLabel, titleOf } from '@/lib/data';
import { firstInLanguage } from '@/lib/english';
import NewsImage from '@/components/NewsImage';
import NewsReportRunner from '@/components/NewsReport';
import AgentAvatar from '@/components/AgentAvatar';
import HeartButton from '@/components/HeartButton';
import { getLikes } from '@/lib/likes';
import { isAgentEnabled } from '@/lib/settings';
import { getPlatformLanguage } from '@/lib/language';

// The News Report Agent runs inside this page's server action: give it time.
export const maxDuration = 300;

type Action = { type: string; title: string; why?: string; next_step?: string; deadline?: string | null; priority?: string };
type Analysis = { verdict: 'act' | 'consider' | 'monitor'; take?: string; actions: Action[]; agent?: string };

const ACTION_LABELS: Record<string, string> = {
  content: 'Publish', participate: 'Participate', announce: 'Announce', outreach: 'Reach out',
  bid: 'Bid', product: 'Product', monitor: 'Monitor',
};
const VERDICTS: Record<string, { label: string; note: string }> = {
  act: { label: 'Act on this', note: 'A clear opening for WalliD' },
  consider: { label: 'Worth considering', note: 'Discuss with the team' },
  monitor: { label: 'Monitor', note: 'Nothing to do yet' },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  await getPlatformLanguage();  // the display filter's language
  const supabase = getSupabaseServerClient();
  const [{ data: n, error }, { data: post }] = await Promise.all([
    supabase.from('news_items').select('*').eq('news_id', params.id).single(),
    supabase.from('feed_posts').select('headline, body').eq('post_id', `news:${params.id}`).maybeSingle(),
  ]);

  if (error || !n) {
    return (
      <div>
        <Link className="back-link" href="/news">← News</Link>
        <div className="detail-block"><h2>Not found</h2><p>{error?.message || 'No news item with this ID.'}</p></div>
      </div>
    );
  }

  // The analyst's complete summary; until it has run, the best English summary we have.
  const paragraphs = (firstInLanguage(n.summary_long) ?? firstInLanguage(post?.body, n.summary) ?? '')
    .split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean);
  const facts: string[] = Array.isArray(n.key_facts) ? n.key_facts.filter((f: string) => firstInLanguage(f)) : [];
  const analysis = n.analysis as Analysis | null;
  const [agentOn, likes] = await Promise.all([isAgentEnabled('news_report'), getLikes('news', [n.news_id])]);
  const domain = n.source_url ? new URL(n.source_url).hostname.replace(/^www\./, '') : n.source_name;

  return (
    <div className="news-detail">
      <Link className="back-link" href="/news">← News</Link>
      <div className="detail-head">
        <div className="detail-tags-row">
          <div className="opp-tags">
          <span className={`tag ${n.category}`}>{newsCategoryLabel(n.category)}</span>
          {n.unverified && <span className="tag unverified">Unverified</span>}
        </div>
          <HeartButton type="news" id={n.news_id} liked={likes.liked.has(n.news_id)} signedIn={likes.signedIn} className="page-heart" />
        </div>
        <h1>{titleOf(n, firstInLanguage(post?.headline))}</h1>
        <p className="page-sub">
          {[n.region, n.published_date ? fmtDate(n.published_date) : null].filter(Boolean).join(' · ')}
        </p>
      </div>

      <section className="detail-block summary-block">
        <div className="summary-head">
          <h2>Summary</h2>
          {n.source_url && (
            <a className="source-link" href={n.source_url} target="_blank" rel="noopener noreferrer">
              Source: {domain} ↗
            </a>
          )}
        </div>
        {n.image_url && <NewsImage src={n.image_url} />}
        {!n.summary_long && <p className="summary-pending">Preview — the News Report Agent replaces this with the full summary.</p>}
        {paragraphs.length ? paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)
          : <p className="muted">No English summary yet.</p>}
        {facts.length > 0 && (
          <ul className="key-facts">{facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        )}
        {n.unverified && <p className="muted">From a tracked social account, not a primary source — treat as unconfirmed.</p>}
      </section>

      <section className="detail-block analysis-block">
        <div className="agent-head">
          <AgentAvatar agent="news_report" working={!analysis && agentOn} off={!agentOn && !analysis} />
          <div className="agent-id">
            <h2>News Report Agent Analysis</h2>
            {n.analysed_at && <span className="agent-name">Report from {fmtDate(n.analysed_at)}</span>}
          </div>
          {analysis && <span className={`verdict ${analysis.verdict}`} title={VERDICTS[analysis.verdict]?.note}>{VERDICTS[analysis.verdict]?.label}</span>}
        </div>

        {!analysis && (agentOn
          ? <NewsReportRunner newsId={n.news_id} lastError={n.report_error ?? null} />
          : <p className="muted">The News Report Agent is switched off in Settings.</p>)}
        {analysis && (
          <>
            {firstInLanguage(analysis.take) && <p className="analysis-take">{analysis.take}</p>}
            <div className="actions">
              {analysis.actions.map((a, i) => (
                <div key={i} className="action">
                  <div className="action-top">
                    <span className={`action-type at-${a.type}`}>{ACTION_LABELS[a.type] ?? a.type}</span>
                    {a.priority && <span className={`action-priority ${a.priority}`}>{a.priority} priority</span>}
                    {a.deadline && <span className="action-deadline">by {fmtDate(a.deadline)}</span>}
                  </div>
                  <h3>{a.title}</h3>
                  {a.why && <p className="action-why">{a.why}</p>}
                  {a.next_step && <p className="action-next"><span>Next step</span>{a.next_step}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
