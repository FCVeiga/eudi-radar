import Link from 'next/link';
import { NewsItem, newsCategoryLabel, titleOf } from '@/lib/data';
import { firstInLanguage } from '@/lib/english';

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export default function NewsRow({ n }: { n: NewsItem }) {
  return (
    <Link href={`/news/${n.news_id}`} className="news-card">
      <div className="list-row-main">
        <div className="news-top">
          <span className={`tag ${n.category}`}>{newsCategoryLabel(n.category)}</span>
          {n.unverified && <span className="tag unverified">Unverified</span>}
          <span className="news-date">{formatDate(n.published_date)}</span>
        </div>
        <div className="news-title">{titleOf(n)}</div>
        {firstInLanguage(n.summary, n.excerpt) && <div className="news-excerpt">{firstInLanguage(n.summary, n.excerpt)}</div>}
        <div className="list-row-meta">
          {n.region}{n.source_name ? <> <span className="sep">·</span> {n.source_name}</> : null}
        </div>
      </div>
    </Link>
  );
}
