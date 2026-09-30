import { NEWS_CATEGORIES, getNews } from '@/lib/data';
import { getSupabaseServerClient } from '@/lib/supabase';
import NewsRow from './NewsRow';
import SectionTabs from './SectionTabs';

type View = 'all' | (typeof NEWS_CATEGORIES)[number]['slug'];

export default async function NewsView({ view }: { view: View }) {
  const { news: all, error } = await getNews();
  const shown = view === 'all' ? all : all.filter((n) => n.category === view);
  const { data: tracked } = await getSupabaseServerClient().from('tracked_accounts').select('*');
  const heading = NEWS_CATEGORIES.find((c) => c.slug === view);

  const tabs = [
    { href: '/news', label: 'All', count: all.length },
    ...NEWS_CATEGORIES.map((c) => ({
      href: `/news/${c.slug}`, label: c.label, count: all.filter((n) => n.category === c.slug).length,
    })),
  ];

  return (
    <div>
      <div className="hero">
        <div>
          <h1>{heading ? heading.label : 'News'}</h1>
          <div className="hero-sub">{heading ? heading.blurb : 'Regulation, industry and market news on digital identity wallets'}</div>
        </div>
      </div>
      <SectionTabs tabs={tabs} active={view === 'all' ? '/news' : `/news/${view}`} />

      {error && <div className="detail-block"><h2>Error loading news</h2><p>{error.message}</p></div>}
      {!error && shown.length === 0 && (
        <div className="sample-note"><strong>No news in this section yet.</strong></div>
      )}

      <div className="news-layout">
        <div>{shown.map((n) => <NewsRow key={n.news_id} n={n} />)}</div>
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
