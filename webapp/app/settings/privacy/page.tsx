import { getCurrentUser } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import PrivacyTab from '@/components/settings/tabs/PrivacyTab';

export default async function PrivacySettings() {
  const user = (await getCurrentUser())!;
  const { data } = await getSupabaseServerClient().from('profiles').select('chat_permission, searchable').eq('id', user.id).maybeSingle();
  return <PrivacyTab chat={data?.chat_permission ?? 'everyone'} searchable={data?.searchable ?? true} />;
}
