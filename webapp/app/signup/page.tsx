import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import { SignupForm } from '@/components/auth/AuthForms';
import { getCurrentUser, safeNext } from '@/lib/auth';

export const metadata = { title: 'Sign up — EUDI Radar' };

export default async function SignupPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthCard title="Sign up" sub="Create your account to follow tenders and news and build your profile.">
      <SignupForm next={next} />
    </AuthCard>
  );
}
