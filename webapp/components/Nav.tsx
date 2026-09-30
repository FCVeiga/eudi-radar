'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OPP_CATEGORIES, NEWS_CATEGORIES } from '@/lib/data';

type Item = { href: string; label: string; children?: { href: string; label: string }[] };

const NAV: Item[] = [
  { href: '/', label: 'Home' },
  {
    href: '/opportunities', label: 'Opportunities',
    children: [
      { href: '/opportunities/new', label: 'New' },
      ...OPP_CATEGORIES.map((c) => ({ href: `/opportunities/${c.path}`, label: c.label })),
    ],
  },
  {
    href: '/news', label: 'News',
    children: NEWS_CATEGORIES.map((c) => ({ href: `/news/${c.slug}`, label: c.label })),
  },
  { href: '/database', label: 'Database' },
  { href: '/landscape', label: 'Landscape' },
];

export default function Nav() {
  const path = usePathname() || '/';
  const inSection = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

  return (
    <nav className="nav-group">
      <div className="nav-label">PAGES</div>
      {NAV.map((item) => {
        const open = !!item.children && inSection(item.href);
        const exact = path === item.href;
        return (
          <div key={item.href}>
            <Link className={`nav-item ${exact || (inSection(item.href) && !item.children) ? 'active' : ''} ${open && !exact ? 'parent' : ''}`}
                  href={item.href}>
              {item.label}
            </Link>
            {item.children && (
              <div className={`nav-sub ${open ? 'open' : ''}`}>
                {item.children.map((c) => (
                  <Link key={c.href} href={c.href} className={`nav-item sub ${path === c.href ? 'active' : ''}`}>{c.label}</Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
