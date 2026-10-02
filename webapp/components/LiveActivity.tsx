'use client';

import { useEffect, useState } from 'react';
import type { SourceActivity as Activity } from '@/lib/sourceMeta';
import SourceIcon from './SourceIcon';

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

// What kind of publisher a source is, for the wording below.
const PUBLISHER: Record<string, 'buyer' | 'media' | 'standards' | 'reddit' | 'social'> = {
  PROCUREMENT_PORTAL: 'buyer', FUNDING_PORTAL: 'buyer', EU_PROGRAMME: 'buyer', LSP: 'buyer', CONSORTIUM: 'buyer',
  GOVERNMENT: 'buyer', DIGITAL_AGENCY: 'buyer', IDENTITY_AUTHORITY: 'buyer', DEVELOPMENT_BANK: 'buyer',
  STANDARDS_BODY: 'standards', NEWS: 'media', INDUSTRY_SOURCE: 'media',
  SOCIAL_REDDIT: 'reddit', SOCIAL_TWITTER: 'social', SOCIAL_LINKEDIN: 'social',
};

/** "<source> <verb>: <title>" — the verb says what the item is (from triage)
 * and fits who published it: a portal *lists* a tender, a news site *reports* one. */
function verb(a: Activity) {
  const who = PUBLISHER[a.sources?.source_type ?? ''] ?? 'media';
  const own = who === 'buyer';
  switch (a.kind) {
    case 'TENDER': return own ? 'listed a tender' : 'reported a tender';
    case 'RFI': return own ? 'opened a market consultation' : 'reported a market consultation';
    case 'GRANT': case 'CONSORTIUM_CALL': case 'PILOT': return own ? 'announced a funding call' : 'reported a funding call';
    case 'PIPELINE_SIGNAL': return own ? 'announced a planned procurement' : 'reported a planned procurement';
  }
  if (who === 'reddit') {
    const h = a.sources?.handle;
    return h?.startsWith('r/') ? <>posted in <span className="la-where">{h}</span></> : 'posted';
  }
  if (who === 'social') return 'posted';
  if (who === 'standards') return 'published an update';
  if (own) return 'published a news release';
  return 'published an article';
}

/** Moltbook-style live panel: latest activity of followed sources, polled every minute. */
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
        {items.length === 0 && <li className="side-empty">No activity yet from the sources you follow.</li>}
        {items.map((a) => (
          <li key={a.id} className="la-item">
            <SourceIcon type={a.sources?.source_type ?? 'NEWS'} size={26} />
            <div className="la-body">
              <p>
                <strong>{(a.sources?.name ?? 'Unknown source').replace(/ — national procurement portal$/, ' portal')}</strong>{' '}
                {verb(a)}:{' '}
                <a href={a.url ?? '#'} target="_blank" rel="noopener noreferrer" className="la-link"
                   title={a.title_en && a.title_en !== a.title ? `Original: ${a.title}` : undefined}>{a.title_en || a.title}</a>
              </p>
              <span className="la-time">{ago(a.published_at, now)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
