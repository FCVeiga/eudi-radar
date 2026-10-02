import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/AuthForms';
import { getCurrentUser, safeNext } from '@/lib/auth';

export const metadata = { title: 'Log in — EUDI Radar' };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const next = safeNext(searchParams.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthCard title="Log in" sub="Follow tenders and news, and get your agents working for you.">
      <LoginForm next={next} error={searchParams.error} />
    </AuthCard>
  );
}
