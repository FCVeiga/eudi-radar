'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/news', label: 'News' },
  { href: '/database', label: 'Database' },
  { href: '/landscape', label: 'Landscape' },
];

export default function TopNav() {
  const path = usePathname() || '/';
  return (
    <nav className="topnav" aria-label="Main">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + '/');
        return (
          <Link key={l.href} href={l.href} className={`topnav-link ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
