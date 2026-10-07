import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AvatarUpload, ProfileDetailsForm, ProfileForm } from '@/components/auth/ProfileForms';
import { getProfile } from '@/lib/profile';

export const metadata = { title: 'Edit profile — EUDI Radar' };

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/profile/edit');
  const p = await getProfile(user.username);
  return (
    <div className="settings profile-edit">
      <Link className="back-link" href={`/u/${user.username}`}>← u/{user.username}</Link>
      <h1 className="opps-h1">Edit profile</h1>

      <section className="detail-block">
        <h2>Profile</h2>
        <AvatarUpload username={user.username} src={user.avatarUrl} />
        <ProfileForm username={user.username} displayName={user.displayName} bio={user.bio || ''} />
      </section>

      <section className="detail-block" id="details">
        <h2>About you</h2>
        <p className="settings-intro">Shown on your profile’s About tab and card.</p>
        <ProfileDetailsForm v={{
          company: p?.company ?? '', role: p?.role ?? '', location: p?.location ?? '', expertise: (p?.expertise ?? []).join(', '),
          website: p?.links.website ?? '', linkedin: p?.links.linkedin ?? '', x: p?.links.x ?? '', github: p?.links.github ?? '',
        }} />
      </section>

      <p className="field-hint">Email, password, plan, notifications and account deletion are in <Link href="/settings">Settings</Link>.</p>
    </div>
  );
}
