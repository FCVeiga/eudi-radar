import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';
import { SettingsTabs } from '@/components/settings/SettingsUI';

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t('Settings')} — Tender Town` };
}

/** Settings: title, tabs (each a sub-page), and the selected page below. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentUser())) redirect('/login?next=/settings/account');
  const t = await getT();
  return (
    <div className="settings st-page">
      <h1 className="opps-h1">{t('Settings')}</h1>
      <SettingsTabs />
      {children}
    </div>
  );
}
