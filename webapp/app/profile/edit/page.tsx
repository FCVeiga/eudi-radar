import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { NewPasswordForm } from '@/components/auth/AuthForms';
import { AvatarUpload, DeleteAccountForm, ProfileForm } from '@/components/auth/ProfileForms';

export const metadata = { title: 'Edit profile — EUDI Radar' };

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/profile/edit');
  return (
    <div className="settings profile-edit">
      <Link className="back-link" href={`/u/${user.username}`}>← u/{user.username}</Link>
      <h1 className="opps-h1">Edit profile</h1>

      <section className="detail-block">
        <h2>Profile</h2>
        <AvatarUpload username={user.username} src={user.avatarUrl} />
        <ProfileForm username={user.username} displayName={user.displayName} bio={user.bio || ''} />
      </section>

      <section className="detail-block">
        <h2>Account</h2>
        <p className="settings-intro">Signed in as <strong>{user.email}</strong> · member since {new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h3 className="form-subhead">Change password</h3>
        <NewPasswordForm />
      </section>

      <section className="detail-block danger-zone">
        <h2>Delete account</h2>
        <DeleteAccountForm username={user.username} />
      </section>
    </div>
  );
}
