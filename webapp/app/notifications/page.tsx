import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { NOTIFICATION_TABS, listNotifications } from '@/lib/social';
import { getSupabaseServerClient } from '@/lib/supabase';
import { NotificationList, NotificationSettings } from '@/components/social/NotificationsPage';

export const metadata = { title: 'Notifications — EUDI Radar' };

export default async function NotificationsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/notifications');
  const tab = NOTIFICATION_TABS.find((t) => t.key === searchParams.tab) ?? NOTIFICATION_TABS[0];
  const [notes, { data: prefs }] = await Promise.all([
    listNotifications(user.id, 100, tab.types),
    getSupabaseServerClient().from('profiles').select('notification_prefs').eq('id', user.id).maybeSingle(),
  ]);
  return (
    <div className="notifications-page">
      <div className="np-main">
        <h1 className="opps-h1">Notifications</h1>
        <nav className="feed-sort" aria-label="Notification types">
          {NOTIFICATION_TABS.map((t) => (
            <Link key={t.key} href={t.key === 'all' ? '/notifications' : `/notifications?tab=${t.key}`}
              className={`feed-sort-link ${tab.key === t.key ? 'active' : ''}`} aria-current={tab.key === t.key ? 'page' : undefined}>{t.label}</Link>
          ))}
        </nav>
        <NotificationList key={tab.key} notes={notes} />
      </div>
      <aside className="np-side"><NotificationSettings prefs={prefs?.notification_prefs || {}} /></aside>
    </div>
  );
}
