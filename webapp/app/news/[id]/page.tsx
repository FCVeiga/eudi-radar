import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { newsCategoryLabel, titleOf } from '@/lib/data';
import { firstEnglish } from '@/lib/english';

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient();

  const { data: n, error } = await supabase
    .from('news_items')
    .select('*')
    .eq('news_id', params.id)
    .single();

  if (error || !n) {
    return (
      <div>
        <Link className="back-link" href="/news">← Back to News</Link>
        <div className="detail-block"><h2>Not found</h2><p>{error?.message || 'No news item with this ID.'}</p></div>
      </div>
    );
  }

  return (
    <div>
      <Link className="back-link" href="/news">← News</Link>
      <div className="detail-head">
        <div className="opp-tags">
          <span className={`tag ${n.category}`}>{newsCategoryLabel(n.category)}</span>
          {n.unverified && <span className="tag unverified">Unverified</span>}
        </div>
        <h1>{titleOf(n)}</h1>
        {titleOf(n) !== n.title && (
          <p className="original-title"><span>Original{n.language ? ` (${n.language.toUpperCase()})` : ''}</span> {n.title}</p>
        )}
        <p className="page-sub">
          {n.region}{n.published_date ? ` · ${new Date(n.published_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        </p>
      </div>
      {firstEnglish(n.summary) && <div className="detail-block"><h2>Summary</h2><p>{n.summary}</p></div>}
      {firstEnglish(n.impact_note) && <div className="detail-block impact-block"><h2>Why it matters</h2><p>{n.impact_note}</p></div>}
      <div className="detail-block">
        <h2>Source</h2>
        <p className="mono">{n.source_name}</p>
        {n.source_url && <p><a className="ext-link" href={n.source_url} target="_blank" rel="noopener noreferrer">{n.source_url} ↗</a></p>}
        {n.unverified && (
          <p className="muted">
            This came from a tracked social account, not a primary source — treat as unconfirmed until cross-checked.
          </p>
        )}
      </div>
    </div>
  );
}
