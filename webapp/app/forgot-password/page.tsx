import AuthCard from '@/components/auth/AuthCard';
import { ForgotForm } from '@/components/auth/AuthForms';

export const metadata = { title: 'Reset your password — EUDI Radar' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" sub="Enter your account’s email and we’ll send you a link to choose a new password.">
      <ForgotForm />
    </AuthCard>
  );
}
