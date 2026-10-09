'use client';

import { useEffect, useState } from 'react';
import type { SourceActivity as Activity } from '@/lib/sourceMeta';
import SourceIcon from './SourceIcon';
import { useLocale, useT } from '@/lib/i18n/client';

type T = ReturnType<typeof useT>;

const POLL_MS = 60_000;

function ago(t: T, locale: string, iso: string | null, now: number) {
  if (!iso) return '';
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{n}m ago', { n: mins });
  const h = Math.round(mins / 60);
  if (h < 24) return t('{n}h ago', { n: h });
  const d = Math.round(h / 24);
  return d < 14 ? t('{n}d ago', { n: d }) : new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
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
function verb(t: T, a: Activity) {
  const who = PUBLISHER[a.sources?.source_type ?? ''] ?? 'media';
  const own = who === 'buyer';
  switch (a.kind) {
    case 'TENDER': return own ? t('listed a tender') : t('reported a tender');
    case 'RFI': return own ? t('opened a market consultation') : t('reported a market consultation');
    case 'GRANT': case 'CONSORTIUM_CALL': case 'PILOT': return own ? t('announced a funding call') : t('reported a funding call');
    case 'PIPELINE_SIGNAL': return own ? t('announced a planned procurement') : t('reported a planned procurement');
  }
  if (who === 'reddit') {
    const h = a.sources?.handle;
    return h?.startsWith('r/') ? <>{t('posted in')} <span className="la-where">{h}</span></> : t('posted');
  }
  if (who === 'social') return t('posted');
  if (who === 'standards') return t('published an update');
  if (own) return t('published a news release');
  return t('published an article');
}

/** Moltbook-style live panel: latest activity of followed sources, polled every minute. */
export default function LiveActivity({ initial }: { initial: Activity[] }) {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  // Phones and tablets show the panel above the feed, collapsed until tapped (desktop: always open).
  const [open, setOpen] = useState(false);

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
    <div className={`live-panel ${open ? 'open' : ''}`}>
      <button type="button" className="live-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="live-title"><span className="live-pulse" />{t('Live activity')}</span>
        <svg className="live-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" /></svg>
      </button>
      <ul className="live-list">
        {items.length === 0 && <li className="side-empty">{t('No activity yet from the sources you follow.')}</li>}
        {items.map((a) => (
          <li key={a.id} className="la-item">
            <SourceIcon type={a.sources?.source_type ?? 'NEWS'} size={26} />
            <div className="la-body">
              <p>
                <strong>{(a.sources?.name ?? t('Unknown source')).replace(/ — national procurement portal$/, ` ${t('portal')}`)}</strong>{' '}
                {verb(t, a)}:{' '}
                <a href={a.url ?? '#'} target="_blank" rel="noopener noreferrer" className="la-link"
                   title={a.title_en && a.title_en !== a.title ? t('Original: {title}', { title: a.title }) : undefined}>{a.title_en || a.title}</a>
              </p>
              <span className="la-time">{ago(t, locale, a.published_at, now)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
