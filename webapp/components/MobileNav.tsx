'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LINKS, isActive } from './SideNav';

const setMenu = (open: boolean) => {
  document.documentElement.toggleAttribute('data-menu-open', open);
};

/** Phones: the top bar's menu button — opens the sidebar (Following, Working Agents, account) as a drawer. */
export function MenuButton() {
  const path = usePathname();
  useEffect(() => setMenu(false), [path]);  // close on navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <button type="button" className="menu-button" aria-label="Open menu: sources, agents and account"
      onClick={() => setMenu(!document.documentElement.hasAttribute('data-menu-open'))}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" /></svg>
    </button>
  );
}

/** Tap outside the drawer to close it. */
export function MenuBackdrop() {
  return <div className="menu-backdrop" onClick={() => setMenu(false)} aria-hidden="true" />;
}

/** Phones: the app's sections as a bottom tab bar (Workspace is in the menu drawer). */
export function BottomNav() {
  const path = usePathname() || '/';
  return (
    <nav className="bottom-nav" aria-label="Sections">
      {LINKS.filter((l) => l.href !== '/workspace').map((l) => {
        const active = isActive(l.href, path);
        return (
          <Link key={l.href} href={l.href} className={`bottom-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="bottom-icon"><svg viewBox="0 0 16 16" aria-hidden="true">{l.icon}</svg></span>
            <span className="bottom-label">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
