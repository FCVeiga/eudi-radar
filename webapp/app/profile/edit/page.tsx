import { redirect } from 'next/navigation';

/** Profile editing lives in Settings → Profile. */
export default function EditProfile() {
  redirect('/settings/profile');
}
