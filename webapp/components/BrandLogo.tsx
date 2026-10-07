import { useId } from 'react';

/**
 * Tender Town's mark: a small town skyline — public buildings, a town hall
 * with its flag — on the blue → mint brand gradient, with the door and
 * windows cut out of the buildings.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-hidden="true" className="brand-mark">
      <defs>
        <linearGradient id={`tt-${id}`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2F6BFF" />
          <stop offset="1" stopColor="#2DD4A7" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#tt-${id})`} />
      {/* flag on the town hall */}
      <path d="M16 4.2v4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M16.6 4.2 20.4 5.6 16.6 7z" fill="#fff" />
      {/* left building, town hall, right building */}
      <path d="M5.5 25.5V15.5l3.5-2.2 3.5 2.2v10z" fill="#fff" opacity="0.85" />
      <path d="M12.5 25.5V12.3L16 8.8l3.5 3.5v13.2z" fill="#fff" />
      <path d="M19.5 25.5V13.2h7v12.3z" fill="#fff" opacity="0.85" />
      {/* door and windows */}
      <path d="M15 25.5v-3.6a1 1 0 0 1 2 0v3.6z" fill={`url(#tt-${id})`} />
      <rect x="14.9" y="14" width="2.2" height="2.6" rx="0.5" fill={`url(#tt-${id})`} />
      <rect x="7.9" y="18" width="2.2" height="2.2" rx="0.5" fill={`url(#tt-${id})`} />
      <rect x="21.4" y="16" width="1.6" height="1.8" rx="0.4" fill={`url(#tt-${id})`} />
      <rect x="23.6" y="16" width="1.6" height="1.8" rx="0.4" fill={`url(#tt-${id})`} />
      <rect x="21.4" y="19.8" width="1.6" height="1.8" rx="0.4" fill={`url(#tt-${id})`} />
      <rect x="23.6" y="19.8" width="1.6" height="1.8" rx="0.4" fill={`url(#tt-${id})`} />
      {/* ground */}
      <rect x="4" y="25.5" width="24" height="1.6" rx="0.8" fill="#fff" />
    </svg>
  );
}

/** Mark + wordmark: "Tender Town". */
export default function BrandLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-logo">
      <BrandMark size={size} />
      <span className="brand-word">Tender<span>Town</span></span>
    </span>
  );
}
