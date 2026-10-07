import AuthCard from '@/components/auth/AuthCard';
import { ForgotForm } from '@/components/auth/AuthForms';
import { getT, getTSync } from '@/lib/i18n/server';

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t('Reset your password')} — Tender Town` };
}

export default function ForgotPasswordPage() {
  const t = getTSync();
  return (
    <AuthCard title={t('Reset your password')} sub={t('Enter your account’s email and we’ll send you a link to choose a new password.')}>
      <ForgotForm />
    </AuthCard>
  );
}
