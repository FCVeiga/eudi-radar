import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { newsCategoryLabel } from '@/lib/data';

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
      <Link className="back-link" href="/news">← Back to News</Link>
      <div className="hero">
        <div>
          <span className={`tag ${n.category}`}>{newsCategoryLabel(n.category)}</span>
          {n.unverified && <span className="tag unverified">Unverified</span>}
          <h1 style={{ marginTop: 10 }}>{n.title}</h1>
          <div className="hero-sub">{n.region} — {n.published_date ? new Date(n.published_date).toLocaleDateString() : ''}</div>
        </div>
      </div>
      <div className="detail-block"><h2>Summary</h2><p>{n.summary}</p></div>
      <div className="detail-block impact-block"><h2>Biometrid Impact Note</h2><p>{n.impact_note}</p></div>
      <div className="detail-block">
        <h2>Source</h2>
        <p className="mono">{n.source_name}</p>
        {n.source_url && <p><a href={n.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)' }}>{n.source_url}</a></p>}
        {n.unverified && (
          <p style={{ marginTop: 6, color: 'var(--muted)' }}>
            This came from a tracked social account, not a primary source — treat as unconfirmed until cross-checked.
          </p>
        )}
      </div>
    </div>
  );
}
