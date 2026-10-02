'use client';

import { useEffect, useState } from 'react';
import type { Activity } from '@/lib/accounts';
import PlatformIcon from './PlatformIcon';

const POLL_MS = 60_000;

function ago(iso: string | null, now: number) {
  if (!iso) return '';
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function verb(a: Activity) {
  const acc = a.tracked_accounts;
  if (acc?.platform === 'reddit') return acc.handle_or_url.startsWith('r/') ? <>posted in <span className="la-where">{acc.handle_or_url}</span></> : 'posted';
  return 'published';
}

/** Moltbook-style live panel: latest activity of followed accounts, polled every minute. */
export default function LiveActivity({ initial }: { initial: Activity[] }) {
  const [items, setItems] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/activity', { cache: 'no-store' });
        if (res.ok && alive) setItems((await res.json()).activity);
      } catch { /* keep what we have */ }
      if (alive) setNow(Date.now());
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="live-panel">
      <div className="live-head">
        <span className="live-title"><span className="live-pulse" />Live activity</span>
        <span className="live-sub">auto-updating</span>
      </div>
      <ul className="live-list">
        {items.length === 0 && <li className="side-empty">No activity yet from the accounts you follow.</li>}
        {items.map((a) => (
          <li key={a.id} className="la-item">
            <PlatformIcon platform={a.tracked_accounts?.platform ?? 'news'} size={26} />
            <div className="la-body">
              <p>
                <strong>{a.tracked_accounts?.display_name ?? 'Unknown'}</strong> {verb(a)}{' '}
                <a href={a.url ?? '#'} target="_blank" rel="noopener noreferrer" className="la-link">{a.title}</a>
              </p>
              <span className="la-time">{ago(a.published_at, now)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
