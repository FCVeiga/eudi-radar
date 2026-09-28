import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';

const CATEGORY_LABELS: Record<string, string> = {
  regulation: 'Regulation',
  govdecision: 'Gov Decision',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
};

export default async function NewsPage() {
  const supabase = getSupabaseServerClient();

  const { data: news, error } = await supabase
    .from('news_items')
    .select('*')
    .order('published_date', { ascending: false });

  const { data: tracked } = await supabase
    .from('tracked_accounts')
    .select('*');

  return (
    <div>
      <div className="hero">
        <div><h1>News</h1><div className="hero-sub">Regulation, government decisions &amp; tracked social accounts</div></div>
      </div>

      {error && (
        <div className="detail-block"><h2>Error loading news</h2><p>{error.message}</p></div>
      )}
      {!error && (!news || news.length === 0) && (
        <div className="sample-note">
          <strong>No news items yet.</strong> The regulation/social monitoring pipeline hasn't populated this table.
        </div>
      )}

      <div className="news-layout">
        <div>
          {(news || []).map((n) => (
            <Link key={n.news_id} href={`/news/${n.news_id}`} className="news-item">
              <div>
                <span className={`tag ${n.category}`}>{CATEGORY_LABELS[n.category] || n.category}</span>
                {n.unverified && <span className="tag unverified">Unverified</span>}
                <div className="news-title">{n.title}</div>
                <div className="news-meta">{n.region}</div>
                <div className="news-excerpt">{n.excerpt}</div>
                <div className="news-source">Source: {n.source_name}</div>
              </div>
              <div className="news-date">{n.published_date ? new Date(n.published_date).toLocaleDateString() : ''}</div>
            </Link>
          ))}
        </div>

        <div className="tracked-panel">
          <h3 className="serif" style={{ fontSize: 14 }}>Tracked Accounts</h3>
          <div className="sidebar-sub">LinkedIn &amp; Twitter/X accounts monitored for this feed</div>
          {(tracked || []).map((a) => (
            <div key={a.id} className="tracked-item" style={{ opacity: a.active ? 1 : 0.5 }}>
              <div>
                <div>{a.display_name}</div>
                <div className="tracked-cat">{a.category} · {a.platform === 'linkedin' ? 'LinkedIn' : 'Twitter/X'}</div>
              </div>
            </div>
          ))}
          {(!tracked || tracked.length === 0) && (
            <div className="sidebar-sub">No accounts configured — populate config/tracked_accounts.yaml and sync to the tracked_accounts table.</div>
          )}
        </div>
      </div>
    </div>
  );
}
