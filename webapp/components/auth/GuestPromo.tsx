'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n/client';
import { GoogleButton } from './AuthForms';

/** Logged-out sidebar: the town banner fills the rest of the panel, with the line and buttons on the picture. */
export default function GuestPromo() {
  const t = useT();
  return (
    <div className="guest-promo">
      <img className="guest-banner" src="/brand/sidebar-banner.jpg" alt="" />
      <div className="guest-overlay">
        <p className="guest-lead">{t('Tender signals, analysis and community.')}</p>
        <div className="guest-actions">
          <GoogleButton next="/" bare />
          <Link href="/signup" className="btn primary">
            <svg className="guest-mail" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 7 9-7" /></svg>
            {t('Continue with email')}
          </Link>
        </div>
      </div>
    </div>
  );
}
