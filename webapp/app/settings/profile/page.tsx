import { getCurrentUser } from '@/lib/auth';
import { getProfile } from '@/lib/profile';
import ProfileTab from '@/components/settings/tabs/ProfileTab';

export default async function ProfileSettings() {
  const user = (await getCurrentUser())!;
  const p = await getProfile(user.username);
  return (
    <ProfileTab username={user.username} displayName={user.displayName} bio={user.bio || ''} avatarUrl={user.avatarUrl}
      work={{ company: p?.company ?? '', role: p?.role ?? '', location: p?.location ?? '', expertise: (p?.expertise ?? []).join(', ') }}
      links={{ website: p?.links.website ?? '', linkedin: p?.links.linkedin ?? '', x: p?.links.x ?? '', github: p?.links.github ?? '' }} />
  );
}
