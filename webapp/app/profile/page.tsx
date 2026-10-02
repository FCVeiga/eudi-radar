import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/** "Profile" in the user menu: your own page. */
export default async function MyProfile() {
  const user = await getCurrentUser();
  redirect(user ? `/u/${user.username}` : '/login?next=/profile');
}
