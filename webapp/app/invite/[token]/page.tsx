import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import AuthCard from '@/components/auth/AuthCard';
import { acceptInvite } from '@/app/workspaces/actions';

export const metadata = { title: 'Join a workspace — EUDI Radar' };

/** An invitation link: shows the workspace and role; joining needs an account (log in or sign up first). */
export default async function InvitePage({ params, searchParams }: { params: { token: string }; searchParams: { error?: string } }) {
  const db = getSupabaseServerClient();
  const { data: inv } = await db.from('account_invites').select('role, email, expires_at, accepted_at, workspaces(name)').eq('token', params.token).maybeSingle();
  const user = await getCurrentUser();
  const valid = inv && !inv.accepted_at && new Date(inv.expires_at) > new Date();
  const team = (inv as any)?.workspaces?.name ?? 'a workspace';
  const join = async () => {
    'use server';
    const r = await acceptInvite(params.token);
    if (r?.error) redirect(`/invite/${params.token}?error=${encodeURIComponent(r.error)}`);
  };
  return (
    <AuthCard title={valid ? `Join ${team}` : 'Invitation not valid'}
      sub={valid ? `You’re invited as ${inv!.role === 'admin' ? 'an admin' : 'a member'}.` : 'Expired or already used. Ask for a new link.'}>
      {searchParams.error && <p className="form-msg err">{searchParams.error}</p>}
      {valid && (user
        ? <form action={join} className="auth-form"><button type="submit" className="btn primary auth-submit">Join {team}</button></form>
        : <div className="auth-form">
            <Link href={`/signup?next=/invite/${params.token}`} className="btn primary auth-submit">Sign up to join</Link>
            <p className="auth-switch">Already have an account? <Link href={`/login?next=/invite/${params.token}`}>Log in</Link></p>
          </div>)}
    </AuthCard>
  );
}
