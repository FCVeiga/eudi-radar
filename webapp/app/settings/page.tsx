import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getContext, getMyAccounts, isPlatformAdmin } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { billingReady } from '@/lib/billing';
import {
  AdminPlanSelect, CreateTeamForm, CreateWorkspaceForm, InviteForm, MemberRow, PlanButton, PortalButton, RevokeInviteButton, WorkspaceRow,
} from '@/components/settings/AccountSettings';

export const metadata = { title: 'Settings — EUDI Radar' };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Settings: per account — billing, team members, workspaces — plus your profile and notifications. */
export default async function SettingsPage({ searchParams }: { searchParams: { account?: string; billing?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings');
  const [all, ctx, platformAdmin] = await Promise.all([getMyAccounts(), getContext(), isPlatformAdmin()]);
  const selected = all.find((a) => a.account.id === searchParams.account) ?? all.find((a) => a.account.id === ctx?.account.id) ?? all[0];
  if (!selected) redirect('/');
  const { account, workspaces } = selected;
  const isAdmin = account.role === 'admin' || (account.kind === 'platform' && platformAdmin);
  const db = getSupabaseServerClient();
  const [{ data: memberRows }, { data: invites }] = await Promise.all([
    db.from('account_members').select('user_id, role, created_at').eq('account_id', account.id),
    isAdmin ? db.from('account_invites').select('id, email, role, created_at, expires_at').eq('account_id', account.id).is('accepted_at', null).gt('expires_at', new Date().toISOString())
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const { data: profiles } = await db.from('profiles').select('id, username, display_name, avatar_url').in('id', (memberRows || []).map((m: any) => m.user_id));
  const members = (memberRows || []).map((m: any) => {
    const p = (profiles || []).find((x: any) => x.id === m.user_id);
    return { userId: m.user_id, role: m.role, username: p?.username ?? 'user', displayName: p?.display_name || p?.username || 'user', avatarUrl: p?.avatar_url ?? null };
  }).sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === 'admin' ? -1 : 1));
  const plans = PLANS.filter((p) => p.key === 'free' || p.kind === (account.kind === 'team' ? 'team' : 'personal'));
  const wsMax = account.kind === 'platform' ? null : account.plan.workspaces;
  const label = (a: typeof account) => (a.kind === 'personal' ? 'Personal' : a.kind === 'platform' ? `${a.name} (platform)` : a.name);

  return (
    <div className="settings">
      <h1 className="opps-h1">Settings</h1>

      <nav className="feed-sort account-tabs" aria-label="Accounts">
        {all.map(({ account: a }) => (
          <Link key={a.id} href={`/settings?account=${a.id}`} className={`feed-sort-link ${a.id === account.id ? 'active' : ''}`}>
            {label(a)}<span className="pill-count">{a.kind === 'platform' ? 'admin' : a.plan.name}</span>
          </Link>
        ))}
        <a href="#create-team" className="feed-sort-link">+ Team</a>
      </nav>

      {searchParams.billing === 'success' && <p className="form-msg ok">Thanks — your plan is being activated. It can take a few seconds to show here.</p>}

      {/* ---------- Billing ---------- */}
      <section className="detail-block" id="billing">
        <h2>Plan &amp; billing</h2>
        {account.kind === 'platform' ? (
          <p className="settings-intro">The platform account holds the default scope that Free users and visitors see. It isn’t billed.</p>
        ) : (
          <>
            <p className="settings-intro">
              {label(account)} is on the <strong>{account.plan.name}</strong> plan
              {account.planStatus === 'comped' ? ' (complimentary)' : account.planStatus !== 'active' ? ` (${account.planStatus.replace('_', ' ')})` : ''}
              {account.periodEnd ? ` · renews ${fmt(account.periodEnd)}` : ''}.
              {!billingReady() && ' Online payments aren’t switched on yet — the platform team can change plans by hand.'}
            </p>
            <div className="plan-grid">
              {plans.map((p) => {
                const current = account.planKey === p.key;
                return (
                  <div key={p.key} className={`plan-card ${current ? 'current' : ''}`}>
                    <div className="plan-head"><h3>{p.name}</h3>{current && <span className="scope-badge">Current</span>}</div>
                    <p className="plan-price"><>€{p.priceEur}<span>/month</span></></p>
                    <p className="plan-blurb">{p.blurb}</p>
                    <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                    {!current && p.key !== 'free' && isAdmin && <PlanButton accountId={account.id} plan={p.key} label={`Choose ${p.name}`} primary />}
                  </div>
                );
              })}
            </div>
            <div className="billing-actions">
              {isAdmin && account.stripeCustomerId && <PortalButton accountId={account.id} />}
              {platformAdmin && <AdminPlanSelect accountId={account.id} plan={account.planKey} options={plans.map((p) => ({ key: p.key, name: p.name }))} />}
            </div>
          </>
        )}
      </section>

      {/* ---------- Team members ---------- */}
      <section className="detail-block" id="members">
        <h2>Team members <span className="uc-count">{members.length}</span></h2>
        {account.kind === 'personal' ? (
          <p className="settings-intro">A personal account has one user. To work with colleagues — admins configure workspaces and scopes, members see the results — create a team on the Teams plan.</p>
        ) : (
          <>
            <p className="settings-intro">Admins create workspaces and configure scopes and agents; members see the results in the team’s workspaces.</p>
            <ul className="member-list">
              {members.map((m) => <MemberRow key={m.userId} accountId={account.id} member={m} canManage={isAdmin} isSelf={m.userId === user.id} />)}
            </ul>
            {isAdmin && (account.kind === 'platform' || account.plan.members === null) && (
              <>
                <h3 className="form-subhead">Invite people</h3>
                <InviteForm accountId={account.id} />
                {(invites || []).length > 0 && (
                  <ul className="member-list invites">
                    {(invites || []).map((i: any) => (
                      <li key={i.id} className="member-row">
                        <span className="member-who"><strong>{i.email || 'Anyone with the link'}</strong><em>{i.role === 'admin' ? 'Admin' : 'Member'} · expires {fmt(i.expires_at)}</em></span>
                        <RevokeInviteButton id={i.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {isAdmin && account.kind === 'team' && account.plan.members !== null && (
              <p className="callout">Inviting people needs the Teams plan — choose it under Plan &amp; billing.</p>
            )}
          </>
        )}
      </section>

      {/* ---------- Workspaces ---------- */}
      <section className="detail-block" id="workspaces">
        <h2>Workspaces <span className="uc-count">{workspaces.length}{wsMax !== null ? `/${wsMax}` : ''}</span></h2>
        <p className="settings-intro">Each workspace has its own scopes. Switch workspaces from your account menu — the whole site shows the one you’re in.</p>
        <ul className="ws-list">
          {workspaces.map((w) => <WorkspaceRow key={w.id} ws={w} current={w.id === ctx?.workspace.id} canManage={isAdmin} />)}
        </ul>
        {isAdmin && (wsMax === null || workspaces.length < wsMax) && <CreateWorkspaceForm accountId={account.id} />}
        {isAdmin && wsMax !== null && workspaces.length >= wsMax && account.kind === 'personal' && (
          <p className="field-hint">Personal plans have one workspace. Teams has unlimited workspaces.</p>
        )}
      </section>

      {/* ---------- You ---------- */}
      <section className="detail-block" id="create-team">
        <h2>Create a team</h2>
        <p className="settings-intro">A team account has its own workspaces, members and plan (Teams, €99/month: unlimited workspaces, members and scopes).</p>
        <CreateTeamForm />
      </section>

      <section className="detail-block">
        <h2>Your profile</h2>
        <div className="settings-links">
          <Link href="/profile/edit" className="btn">Edit profile &amp; password</Link>
          <Link href="/notifications" className="btn">Notification settings</Link>
          <Link href="/workspace" className="btn">Workspace (scopes &amp; agents)</Link>
        </div>
      </section>
    </div>
  );
}
