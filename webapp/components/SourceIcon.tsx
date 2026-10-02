import { typeMeta } from '@/lib/sourceMeta';

/** Round badge for a source: brand marks for social platforms, a glyph per kind otherwise. */
export default function SourceIcon({ type, size = 24 }: { type: string; size?: number }) {
  const icon = typeMeta(type).icon;
  const common = { width: size, height: size, viewBox: '0 0 28 28', 'aria-hidden': true } as const;
  if (icon === 'twitter') return (
    <svg {...common}><circle cx="14" cy="14" r="14" fill="#0F1419" />
      <path fill="#fff" d="M17.6 8h2l-4.4 5 5.2 7h-4.1l-3.2-4.2L9.4 20h-2l4.7-5.4L7.1 8h4.2l2.9 3.8zm-.7 10.8H18L10.7 9.1H9.5z" /></svg>
  );
  if (icon === 'linkedin') return (
    <svg {...common}><circle cx="14" cy="14" r="14" fill="#0A66C2" />
      <path fill="#fff" d="M9.2 11.6h2.3V19H9.2zm1.15-3.7a1.33 1.33 0 1 1 0 2.66 1.33 1.33 0 0 1 0-2.66zM13 11.6h2.2v1h.03c.3-.58 1.06-1.2 2.18-1.2 2.33 0 2.76 1.53 2.76 3.53V19h-2.3v-3.6c0-.86-.02-1.97-1.2-1.97-1.2 0-1.38.94-1.38 1.9V19H13z" /></svg>
  );
  if (icon === 'reddit') return (
    <svg {...common}><circle cx="14" cy="14" r="14" fill="#FF4500" />
      <ellipse cx="14" cy="16" rx="6.2" ry="4.3" fill="#fff" />
      <circle cx="19.6" cy="12.6" r="1.3" fill="#fff" /><circle cx="8.4" cy="12.6" r="1.3" fill="#fff" />
      <circle cx="16.6" cy="7.6" r="1.1" fill="#fff" /><path d="M14 11.7l1-4 1.6.4" stroke="#fff" strokeWidth="0.9" fill="none" />
      <circle cx="11.8" cy="15.4" r="0.95" fill="#FF4500" /><circle cx="16.2" cy="15.4" r="0.95" fill="#FF4500" />
      <path d="M11.9 17.8c1.2.8 3 .8 4.2 0" stroke="#FF4500" strokeWidth="0.8" fill="none" strokeLinecap="round" /></svg>
  );
  // Line glyphs on a tinted disc, one colour per kind of source.
  const glyph: Record<string, [string, string, JSX.Element]> = {
    news: ['#E3F8FD', '#0A8FB8', <><circle cx="10" cy="18" r="1.5" fill="#0A8FB8" stroke="none" /><path d="M8.6 12.8a6.6 6.6 0 0 1 6.6 6.6M8.6 9a10.4 10.4 0 0 1 10.4 10.4" /></>],
    portal: ['#E9EFFD', '#2F5BD8', <><rect x="7.5" y="10.5" width="13" height="9" rx="1.5" /><path d="M11.5 10.5V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M7.5 14.5h13" /></>],
    funding: ['#E4F6EE', '#0E8A5F', <><circle cx="14" cy="14" r="6" /><path d="M16.2 11.4a3 3 0 1 0 0 5.2M10.8 13.2h3.6M10.8 15h3.6" /></>],
    government: ['#F1ECFC', '#7A4FD6', <><path d="M7.5 11.2 14 7.8l6.5 3.4zM8.5 19.5h11M9.8 12v6M12.6 12v6M15.4 12v6M18.2 12v6" /></>],
    standards: ['#FDF1E2', '#B4630A', <><path d="M14 7.5 19.5 9.6v4c0 3.4-2.3 5.8-5.5 6.9-3.2-1.1-5.5-3.5-5.5-6.9v-4z" /><path d="m11.6 14 1.7 1.7 3.2-3.3" /></>],
    bank: ['#EEF1F5', '#4A5873', <><path d="M7.5 11 14 7.8l6.5 3.2M8.8 19.5h10.4M10 12.5v5.2M14 12.5v5.2M18 12.5v5.2" /></>],
  };
  const [bg, fg, g] = glyph[icon] ?? glyph.government;
  return (
    <svg {...common}><circle cx="14" cy="14" r="14" fill={bg} />
      <g fill="none" stroke={fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{g}</g></svg>
  );
}
