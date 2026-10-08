'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n/client';

/** The upgrade prompt: the line, then the button. Title defaults to the agent-report line. */
export function UpgradeReport({ note, title }: { note?: string; title?: string }) {
  const t = useT();
  return (
    <div className="profile-empty">
      {note && <p className="agent-intro">{note}</p>}
      <p className="profile-empty-title">{t(title || 'Upgrade Plan to See Agent Report')}</p>
      <Link href="/settings/account?plan=1" className="btn primary profile-empty-cta">{t('Upgrade plan')}</Link>
    </div>
  );
}
