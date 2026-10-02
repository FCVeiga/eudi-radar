'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import { logOut } from '@/app/auth/actions';

const ITEMS = [
  { href: 'profile', label: 'Profile', icon: <><circle cx="8" cy="5.5" r="2.8" /><path d="M2.8 14c.6-2.8 2.7-4.4 5.2-4.4s4.6 1.6 5.2 4.4" /></> },
  { href: '/help', label: 'Help', icon: <><circle cx="8" cy="8" r="6" /><path d="M6.3 6.3a1.8 1.8 0 1 1 2.5 1.6c-.5.3-.8.6-.8 1.2M8 11.3v.01" /></> },
  { href: '/terms', label: 'Terms & Conditions', icon: <><path d="M4 2.5h5.5L12 5v8.5H4z" /><path d="M9.5 2.5V5H12M6 8h4M6 10.5h4" /></> },
  { href: '/privacy', label: 'Privacy policy', icon: <><path d="M8 2 3 4v4c0 3 2.2 5.2 5 6 2.8-.8 5-3 5-6V4z" /><path d="m6 8 1.5 1.5L10.5 6.5" /></> },
];

/** Navbar: the signed-in user's picture and name, opening a menu. */
export default function UserMenu({ user }: { user: { username: string; displayName: string; avatarUrl: string | null } }) {
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
    <div className="user-menu" ref={box}>
      <button type="button" className="user-menu-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <UserAvatar name={user.username} src={user.avatarUrl} size={30} />
        <span className="user-menu-name">{user.displayName}</span>
        <svg className="user-menu-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" /></svg>
      </button>
      {open && (
        <div className="user-menu-list" role="menu">
          <div className="user-menu-who">
            <UserAvatar name={user.username} src={user.avatarUrl} size={36} />
            <div><strong>{user.displayName}</strong><span>u/{user.username}</span></div>
          </div>
          {ITEMS.map((i) => (
            <Link key={i.href} role="menuitem" href={i.href === 'profile' ? `/u/${user.username}` : i.href} className="user-menu-item">
              <svg viewBox="0 0 16 16" aria-hidden="true">{i.icon}</svg>{i.label}
            </Link>
          ))}
          <form action={logOut}>
            <button type="submit" role="menuitem" className="user-menu-item danger">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.5H3.5v11H6M10 5l3 3-3 3M13 8H6.5" /></svg>Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
