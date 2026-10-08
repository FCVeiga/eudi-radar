'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

const ITEMS = [
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/privacy', label: 'Privacy Policy' },
];

/** Navbar overflow for visitors: About, Blog, Pricing, Privacy. */
export default function GuestMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="guest-menu" ref={box}>
      <button type="button" className="guest-menu-button" aria-haspopup="menu" aria-expanded={open} aria-label={t('More')} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.2" cy="8" r="1.35" /><circle cx="8" cy="8" r="1.35" /><circle cx="12.8" cy="8" r="1.35" /></svg>
      </button>
      {open && (
        <div className="guest-menu-list" role="menu">
          {ITEMS.map((i) => (
            <Link key={i.href} role="menuitem" href={i.href} className="user-menu-item">{t(i.label)}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
