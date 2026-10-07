'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';

/** The upgrade prompt for agent reports: the line, then the button. */
export function UpgradeReport({ note }: { note?: string }) {
  const t = useT();
  return (
    <div className="profile-empty">
      {note && <p className="agent-intro">{note}</p>}
      <p className="profile-empty-title">{t('Upgrade Plan to See Agent Report')}</p>
      <Link href="/settings/account?plan=1" className="btn primary profile-empty-cta">{t('Upgrade plan')}</Link>
    </div>
  );
}

/** A button that reveals the upgrade prompt instead of doing the action. */
export function UpgradeOnClick({ label, autoOpen = false }: { label: string; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <div className="upgrade-reveal">
      <button type="button" className="btn" onClick={() => setOpen(true)}>{label}</button>
      {open && <UpgradeReport />}
    </div>
  );
}
