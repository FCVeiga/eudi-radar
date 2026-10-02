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
      <div className="page-head">
        <div>
          <div className="eyebrow">News</div>
          <h1>{heading ? heading.label : 'All news'}</h1>
          <p className="page-sub">{heading ? heading.blurb : 'Regulation, industry and market news on digital identity wallets'}</p>
        </div>
      </div>
      <SectionTabs tabs={tabs} active={view === 'all' ? '/news' : `/news/${view}`} />

      {error && <div className="callout error"><strong>Error loading news.</strong> {error.message}</div>}
      {!error && shown.length === 0 && (
        <div className="callout"><strong>No news in this section yet.</strong></div>
      )}

      <div className="news-layout">
        <div className="news-list">{shown.map((n) => <NewsRow key={n.news_id} n={n} />)}</div>
        <aside className="panel tracked-panel">
          <div className="panel-head"><h3>Tracked accounts</h3></div>
          <div className="panel-empty">LinkedIn &amp; Twitter/X accounts monitored for this feed</div>
          {(tracked || []).map((a) => (
            <div key={a.id} className={`tracked-item ${a.active ? '' : 'inactive'}`}>
              <div>
                <div>{a.display_name}</div>
                <div className="tracked-cat">{a.category} · {a.platform === 'linkedin' ? 'LinkedIn' : 'Twitter/X'}</div>
              </div>
            </div>
          ))}
          {(!tracked || tracked.length === 0) && (
            <div className="panel-empty">No accounts configured — populate config/tracked_accounts.yaml and sync to the tracked_accounts table.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
