import Link from 'next/link';

export type Tab = { href: string; label: string; count?: number };

/** In-page section tabs (mirrors the sidebar sub-nav; the only nav on narrow screens). */
export default function SectionTabs({ tabs, active }: { tabs: Tab[]; active: string }) {
  return (
    <div className="filters">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`filter-link ${t.href === active ? 'active' : ''}`}>
          {t.label}{t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}
