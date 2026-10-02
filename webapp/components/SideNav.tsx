'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Home', icon: <path d="M2.5 7.2 8 2.5l5.5 4.7V13a.5.5 0 0 1-.5.5H9.6V9.8H6.4v3.7H3a.5.5 0 0 1-.5-.5z" /> },
  { href: '/tenders', label: 'Tenders', icon: <><rect x="2" y="4.5" width="12" height="9" rx="1.5" /><path d="M5.5 4.5V3.2c0-.4.3-.7.7-.7h3.6c.4 0 .7.3.7.7v1.3M2 8.5h12" /></> },
  { href: '/news', label: 'News', icon: <><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M5 5.5h6M5 8h6M5 10.5h3.5" /></> },
  { href: '/history', label: 'History', icon: <><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" /></> },
  { href: '/landscape', label: 'Landscape', icon: <><circle cx="8" cy="8" r="5.8" /><path d="M2.2 8h11.6M8 2.2c1.8 1.8 2.6 3.7 2.6 5.8S9.8 12 8 13.8C6.2 12 5.4 10.1 5.4 8S6.2 4 8 2.2z" /></> },
];

export default function SideNav() {
  const path = usePathname() || '/';
  return (
    <nav className="side-nav" aria-label="Sections">
      {LINKS.map((l) => {
        const active = l.href === '/' ? path === '/' : path === l.href || path.startsWith(l.href + '/');
        return (
          <Link key={l.href} href={l.href} className={`side-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
            <svg viewBox="0 0 16 16" aria-hidden="true">{l.icon}</svg>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
