/** Social profile links with brand icons (profile card and About tab). */
import { getTSync } from '@/lib/i18n/server';

type Links = { website: string | null; linkedin: string | null; x: string | null; github: string | null };

const ICONS = {
  linkedin: { label: 'LinkedIn', path: <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3zM9.5 9.75h3.8v1.6h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.07c0-1.21-.02-2.77-1.69-2.77-1.69 0-1.95 1.32-1.95 2.68V21h-4z" /> },
  x: { label: 'X', path: <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78zm-1.08 16.18h1.7L7.4 4.73H5.58z" /> },
  github: { label: 'GitHub', path: <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" /> },
  website: { label: 'Website', path: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" /></> },
} as const;

export const hasLinks = (l: Links) => !!(l.linkedin || l.x || l.github || l.website);

export default function SocialLinks({ links, variant = 'icons' }: { links: Links; variant?: 'icons' | 'list' }) {
  const items = (['linkedin', 'x', 'github', 'website'] as const).filter((k) => links[k]);
  if (!items.length) return null;
  const t = getTSync();
  return (
    <div className={`social-links ${variant}`}>
      {items.map((k) => {
        const url = links[k]!;
        const shown = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        const label = t(ICONS[k].label);
        return (
          <a key={k} href={url} target="_blank" rel="noopener noreferrer me" className={`social-link ${k}`} aria-label={`${label}: ${shown}`} title={label}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[k].path}</svg>
            {variant === 'list' && <span><strong>{label}</strong><em>{shown}</em></span>}
          </a>
        );
      })}
    </div>
  );
}
