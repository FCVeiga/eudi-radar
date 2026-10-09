import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import { NewPasswordForm } from '@/components/auth/AuthForms';
import { getCurrentUser } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';
import { NOINDEX } from '@/lib/seo';

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t('Choose a new password')} — Tender Town`, ...NOINDEX };
}

/** Reached from the reset email's link (/auth/callback signs the user in first). */
export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect('/forgot-password');
  const t = await getT();
  return (
    <AuthCard title={t('Choose a new password')}>
      <NewPasswordForm then="home" />
    </AuthCard>
  );
}
