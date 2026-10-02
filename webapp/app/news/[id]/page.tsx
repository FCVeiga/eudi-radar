import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { newsCategoryLabel, titleOf } from '@/lib/data';
import { firstEnglish } from '@/lib/english';
import NewsImage from '@/components/NewsImage';

type Action = { type: string; title: string; why?: string; next_step?: string; deadline?: string | null; priority?: string };
type Analysis = { verdict: 'act' | 'consider' | 'monitor'; take?: string; actions: Action[] };

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
  const paragraphs = (firstEnglish(n.summary_long) ?? firstEnglish(post?.body, n.summary) ?? '')
    .split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean);
  const facts: string[] = Array.isArray(n.key_facts) ? n.key_facts.filter((f: string) => firstEnglish(f)) : [];
  const analysis = n.analysis as Analysis | null;
  const domain = n.source_url ? new URL(n.source_url).hostname.replace(/^www\./, '') : n.source_name;

  return (
    <div className="news-detail">
      <Link className="back-link" href="/news">← News</Link>
      <div className="detail-head">
        <div className="opp-tags">
          <span className={`tag ${n.category}`}>{newsCategoryLabel(n.category)}</span>
          {n.unverified && <span className="tag unverified">Unverified</span>}
        </div>
        <h1>{titleOf(n, firstEnglish(post?.headline))}</h1>
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
        {paragraphs.length ? paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)
          : <p className="muted">No English summary yet.</p>}
        {facts.length > 0 && (
          <ul className="key-facts">{facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        )}
        {n.unverified && <p className="muted">From a tracked social account, not a primary source — treat as unconfirmed.</p>}
      </section>

      <section className="detail-block analysis-block">
        <div className="analysis-head">
          <h2>Agent Analysis</h2>
          {analysis && <span className={`verdict ${analysis.verdict}`} title={VERDICTS[analysis.verdict]?.note}>{VERDICTS[analysis.verdict]?.label}</span>}
        </div>
        {!analysis ? (
          <p className="muted">The analyst agent hasn&apos;t reviewed this story yet — it reads the full article in the next run.</p>
        ) : (
          <>
            {firstEnglish(analysis.take) && <p className="analysis-take">{analysis.take}</p>}
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
