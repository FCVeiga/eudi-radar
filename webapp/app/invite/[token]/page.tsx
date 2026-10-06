import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import AuthCard from '@/components/auth/AuthCard';
import { acceptInvite } from '@/app/settings/actions';

export const metadata = { title: 'Join a team — EUDI Radar' };

/** An invitation link: shows the team and role; joining needs an account (log in or sign up first). */
export default async function InvitePage({ params, searchParams }: { params: { token: string }; searchParams: { error?: string } }) {
  const db = getSupabaseServerClient();
  const { data: inv } = await db.from('account_invites').select('role, email, expires_at, accepted_at, accounts(name)').eq('token', params.token).maybeSingle();
  const user = await getCurrentUser();
  const valid = inv && !inv.accepted_at && new Date(inv.expires_at) > new Date();
  const team = (inv as any)?.accounts?.name ?? 'a team';
  const join = async () => {
    'use server';
    const r = await acceptInvite(params.token);
    if (r?.error) redirect(`/invite/${params.token}?error=${encodeURIComponent(r.error)}`);
  };
  return (
    <AuthCard title={valid ? `Join ${team}` : 'Invitation not valid'}
      sub={valid ? `You’re invited as ${inv!.role === 'admin' ? 'an admin — you’ll configure the team’s workspaces and agents' : 'a member — you’ll see the results of the team’s agents'}.` : 'This invitation has expired or was already used. Ask the team’s admin for a new link.'}>
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
