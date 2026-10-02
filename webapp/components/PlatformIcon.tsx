import type { Platform } from '@/lib/platforms';

/** Small round platform badges for followed accounts and activity rows. */
export default function PlatformIcon({ platform, size = 28 }: { platform: Platform | string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 28 28', 'aria-hidden': true } as const;
  switch (platform) {
    case 'twitter':
      return (
        <svg {...common}><circle cx="14" cy="14" r="14" fill="#0F1419" />
          <path fill="#fff" d="M17.6 8h2l-4.4 5 5.2 7h-4.1l-3.2-4.2L9.4 20h-2l4.7-5.4L7.1 8h4.2l2.9 3.8zm-.7 10.8H18L10.7 9.1H9.5z" /></svg>
      );
    case 'linkedin':
      return (
        <svg {...common}><circle cx="14" cy="14" r="14" fill="#0A66C2" />
          <path fill="#fff" d="M9.2 11.6h2.3V19H9.2zm1.15-3.7a1.33 1.33 0 1 1 0 2.66 1.33 1.33 0 0 1 0-2.66zM13 11.6h2.2v1h.03c.3-.58 1.06-1.2 2.18-1.2 2.33 0 2.76 1.53 2.76 3.53V19h-2.3v-3.6c0-.86-.02-1.97-1.2-1.97-1.2 0-1.38.94-1.38 1.9V19H13z" /></svg>
      );
    case 'reddit':
      return (
        <svg {...common}><circle cx="14" cy="14" r="14" fill="#FF4500" />
          <ellipse cx="14" cy="16" rx="6.2" ry="4.3" fill="#fff" />
          <circle cx="19.6" cy="12.6" r="1.3" fill="#fff" /><circle cx="8.4" cy="12.6" r="1.3" fill="#fff" />
          <circle cx="16.6" cy="7.6" r="1.1" fill="#fff" /><path d="M14 11.7l1-4 1.6.4" stroke="#fff" strokeWidth="0.9" fill="none" />
          <circle cx="11.8" cy="15.4" r="0.95" fill="#FF4500" /><circle cx="16.2" cy="15.4" r="0.95" fill="#FF4500" />
          <path d="M11.9 17.8c1.2.8 3 .8 4.2 0" stroke="#FF4500" strokeWidth="0.8" fill="none" strokeLinecap="round" /></svg>
      );
    default: // news site / RSS
      return (
        <svg {...common}><circle cx="14" cy="14" r="14" fill="#E3F8FD" />
          <circle cx="10" cy="18" r="1.6" fill="#0A8FB8" />
          <path d="M8.4 12.6a7 7 0 0 1 7 7M8.4 8.6a11 11 0 0 1 11 11" stroke="#0A8FB8" strokeWidth="1.9" fill="none" strokeLinecap="round" /></svg>
      );
  }
}
