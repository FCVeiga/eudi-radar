import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import { NewPasswordForm } from '@/components/auth/AuthForms';
import { getCurrentUser } from '@/lib/auth';

export const metadata = { title: 'Choose a new password — EUDI Radar' };

/** Reached from the reset email's link (/auth/callback signs the user in first). */
export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect('/forgot-password');
  return (
    <AuthCard title="Choose a new password">
      <NewPasswordForm then="home" />
    </AuthCard>
  );
}
