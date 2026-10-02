import Link from 'next/link';
import { NewsItem, newsCategoryLabel } from '@/lib/data';

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/** One news item: a full card on News pages, a list row inside home panels. */
export default function NewsRow({ n, compact = false }: { n: NewsItem; compact?: boolean }) {
  return (
    <Link href={`/news/${n.news_id}`} className={compact ? 'list-row' : 'news-card'}>
      <div className="list-row-main">
        <div className="news-top">
          <span className={`tag ${n.category}`}>{newsCategoryLabel(n.category)}</span>
          {n.unverified && <span className="tag unverified">Unverified</span>}
          <span className="news-date">{formatDate(n.published_date)}</span>
        </div>
        <div className={compact ? 'list-row-title' : 'news-title'}>{n.title}</div>
        {!compact && (n.summary || n.excerpt) && <div className="news-excerpt">{n.summary || n.excerpt}</div>}
        <div className="list-row-meta">
          {n.region}{n.source_name ? <> <span className="sep">·</span> {n.source_name}</> : null}
        </div>
      </div>
    </Link>
  );
}
