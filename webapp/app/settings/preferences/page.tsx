import { getCurrentUser } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import PreferencesTab from '@/components/settings/tabs/PreferencesTab';

export default async function PreferencesSettings() {
  const user = (await getCurrentUser())!;
  const { data } = await getSupabaseServerClient().from('profiles').select('ui_language, theme').eq('id', user.id).maybeSingle();
  return <PreferencesTab lang={data?.ui_language ?? 'en'} theme={data?.theme ?? 'auto'} />;
}
