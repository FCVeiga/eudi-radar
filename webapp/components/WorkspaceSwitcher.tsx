'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { switchWorkspace } from '@/app/workspaces/actions';
import { useT } from '@/lib/i18n/client';

export type SwitcherWorkspace = { id: string; name: string; sharedBy: string | null; role: 'admin' | 'member' };

const initial = (name: string) => (name.trim()[0] || 'W').toUpperCase();
// A stable colour per workspace, so each is recognisable at a glance.
const HUES = ['#0A8FB8', '#7A4FD6', '#B5367F', '#0E8A5F', '#B4630A', '#2F5BD8', '#C2413A'];
const hue = (id: string) => HUES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];

export function WorkspaceMark({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  return <span className="ws-mark" style={{ width: size, height: size, background: hue(id), fontSize: size * 0.46 }} aria-hidden="true">{initial(name)}</span>;
}

/** Sidebar: the active workspace; click to switch to another one (like switching accounts). */
export default function WorkspaceSwitcher({ workspaces, activeId }: { workspaces: SwitcherWorkspace[]; activeId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  useEffect(() => setOpen(false), [path, activeId]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!active) return null;
  // Workspace pages belong to one workspace: after switching, land on the list instead.
  const next = path?.startsWith('/workspaces/') ? '/workspaces' : path || '/';

  return (
    <div className="ws-switcher" ref={box}>
      <button type="button" className={`ws-current ${open ? 'open' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <WorkspaceMark id={active.id} name={active.name} />
        <span className="ws-current-text">
          <em>{t('Workspace')}</em>
          <strong>{pending && target ? workspaces.find((w) => w.id === target)?.name : active.name}</strong>
        </span>
        <svg className="ws-chevrons" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 6 3-3 3 3M5 10l3 3 3-3" /></svg>
      </button>
      {open && (
        <div className="ws-pop" role="listbox" aria-label={t('Switch workspace')}>
          {workspaces.map((w) => {
            const on = w.id === active.id;
            return (
              <button key={w.id} type="button" role="option" aria-selected={on} className={`ws-option ${on ? 'on' : ''}`} disabled={pending}
                onClick={() => { if (on) { setOpen(false); return; } setTarget(w.id); start(() => switchWorkspace(w.id, next)); }}>
                <WorkspaceMark id={w.id} name={w.name} size={24} />
                <span className="ws-option-text"><strong>{w.name}</strong><em>{w.sharedBy ? `u/${w.sharedBy}` : t('Yours')} · {w.role === 'admin' ? t('Admin') : t('Member')}</em></span>
                {on && <svg className="ws-tick" viewBox="0 0 16 16" aria-label={t('Active')}><path d="m3.5 8.5 3 3 6-7" /></svg>}
              </button>
            );
          })}
          <div className="ws-pop-foot">
            <Link href="/workspaces">{t('Manage')}</Link>
            <Link href="/workspaces?new=1">+ {t('New')}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
