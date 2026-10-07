import { getCurrentUser } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import NotificationsTab from '@/components/settings/tabs/NotificationsTab';

export default async function NotificationSettingsPage() {
  const user = (await getCurrentUser())!;
  const { data } = await getSupabaseServerClient().from('profiles').select('notification_prefs').eq('id', user.id).maybeSingle();
  return <NotificationsTab prefs={data?.notification_prefs || {}} />;
}
