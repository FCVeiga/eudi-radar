import { NEWS_CATEGORIES, getNews } from '@/lib/data';
import NewsRow from './NewsRow';
import SectionTabs from './SectionTabs';

type View = 'all' | (typeof NEWS_CATEGORIES)[number]['slug'];

export default async function NewsView({ view }: { view: View }) {
  const { news: all, error } = await getNews();
  const shown = view === 'all' ? all : all.filter((n) => n.category === view);
  const heading = NEWS_CATEGORIES.find((c) => c.slug === view);

  const tabs = [
    { href: '/news', label: 'All', count: all.length },
    ...NEWS_CATEGORIES.map((c) => ({
      href: `/news/${c.slug}`, label: c.label, count: all.filter((n) => n.category === c.slug).length,
    })),
  ];

  return (
    <div>
      <h1 className="opps-h1">{heading ? heading.label : 'EUDI News'}</h1>
      <SectionTabs tabs={tabs} active={view === 'all' ? '/news' : `/news/${view}`} />

      {error && <div className="callout error"><strong>Error loading news.</strong> {error.message}</div>}
      {!error && shown.length === 0 && (
        <div className="callout"><strong>No news in this section yet.</strong></div>
      )}

      <div className="news-list">{shown.map((n) => <NewsRow key={n.news_id} n={n} />)}</div>
    </div>
  );
}
