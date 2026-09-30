import Link from 'next/link';
import { NewsItem, newsCategoryLabel } from '@/lib/data';

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export default function NewsRow({ n, compact = false }: { n: NewsItem; compact?: boolean }) {
  return (
    <Link href={`/news/${n.news_id}`} className={`news-item ${compact ? 'compact' : ''}`}>
      <div>
        <span className={`tag ${n.category}`}>{newsCategoryLabel(n.category)}</span>
        {n.unverified && <span className="tag unverified">Unverified</span>}
        <div className="news-title">{n.title}</div>
        <div className="news-meta">{n.region}{n.source_name ? ` · ${n.source_name}` : ''}</div>
        {!compact && <div className="news-excerpt">{n.summary || n.excerpt}</div>}
      </div>
      <div className="news-date">{formatDate(n.published_date)}</div>
    </Link>
  );
}
