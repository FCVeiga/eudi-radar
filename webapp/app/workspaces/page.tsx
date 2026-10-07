import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getContext, getMyWorkspaces, getPersonalAccount } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { AddMemberButton, MemberRow, NewWorkspaceButton } from '@/components/settings/WorkspaceControls';
import { WorkspaceMark } from '@/components/WorkspaceSwitcher';
import { switchWorkspace } from './actions';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t('Workspaces')} — Tender Town` };
}

/** Workspace: your workspaces (each opens its scopes and members). Plans are on Settings. */
export default async function WorkspacesPage({ searchParams }: { searchParams: { new?: string } }) {
  const user = await getCurrentUser();
  const ctx = await getContext();
  if (!user || !ctx) redirect('/login?next=/workspaces');
  const t = await getT();
  const db = getSupabaseServerClient();
  const [mine, account] = await Promise.all([getMyWorkspaces(), getPersonalAccount(user.id)]);
  const wsIds = mine.map((m) => m.workspace.id);
  const [{ data: scopeRows }, { data: memberRows }, { data: defaultScope }] = await Promise.all([
    db.from('scopes').select('workspace_id, is_default').in('workspace_id', wsIds),
    db.from('workspace_members').select('workspace_id').in('workspace_id', wsIds),
    db.from('scopes').select('id').eq('is_default', true).maybeSingle(),
  ]);
  const tally = (rows: any[] | null, id: string) => (rows || []).filter((r) => r.workspace_id === id).length;
  const scopeCount = (id: string) => {
    const rows = (scopeRows || []).filter((r) => r.workspace_id === id);
    return rows.length + (defaultScope && !rows.some((r) => r.is_default) ? 1 : 0);
  };
  const owned = mine.filter((m) => m.workspace.ownerId === user.id && !m.isDefault);
  const myPlan = account?.plan ?? PLANS[0];
  const teams = myPlan.key === 'teams';
  const canCreateWs = myPlan.workspaces === null || owned.length < myPlan.workspaces;
  const activeId = ctx.workspace.id;
  const { data: activeMemberRows } = teams
    ? await db.from('workspace_members').select('user_id, role').eq('workspace_id', activeId)
    : { data: [] as any[] };
  const { data: profiles } = (activeMemberRows || []).length
    ? await db.from('profiles').select('id, username, display_name, avatar_url').in('id', (activeMemberRows || []).map((m: any) => m.user_id))
    : { data: [] as any[] };
  const members = (activeMemberRows || []).map((m: any) => {
    const p = (profiles || []).find((x: any) => x.id === m.user_id);
    return { userId: m.user_id, role: m.role, username: p?.username ?? 'user', displayName: p?.display_name || p?.username || 'user', avatarUrl: p?.avatar_url ?? null };
  }).sort((a, b) => Number(b.userId === ctx.workspace.ownerId) - Number(a.userId === ctx.workspace.ownerId)
    || (a.role === b.role ? a.username.localeCompare(b.username) : a.role === 'admin' ? -1 : 1));

  return (
    <div className="settings">
      <h1 className="opps-h1">{t('Workspaces')}</h1>

      {/* ---------- Your workspaces ---------- */}
      <section className="detail-block" id="workspaces">
        <div className="section-head">
          <h2>{t('Your workspaces')} <span className="uc-count">{mine.length}</span></h2>
          {canCreateWs ? <NewWorkspaceButton autoOpen={searchParams.new === '1'} /> : <Link href="/settings/account?plan=1" className="btn">{t('Upgrade for more')}</Link>}
        </div>
        <div className="table-wrap">
          <table className="data-table ws-table">
            <thead><tr><th>{t('Workspace')}</th><th>{t('Owner')}</th><th className="num">{t('Scopes')}</th><th className="num">{t('Members')}</th><th className="num" /></tr></thead>
            <tbody>
              {mine.map((m) => {
                const href = `/workspaces/${m.workspace.id}`;
                const active = m.workspace.id === ctx.workspace.id;
                return (
                  <tr key={m.workspace.id} className={active ? 'ws-active-row' : ''}>
                    <td><Link href={href} className="ws-table-cell"><WorkspaceMark id={m.workspace.id} name={m.workspace.name} size={26} /><span className="ws-table-name">{m.workspace.name}</span></Link></td>
                    <td>{m.workspace.ownerId === user.id ? t('You') : `u/${m.owner.username}`}</td>
                    <td className="num">{scopeCount(m.workspace.id)}</td>
                    <td className="num">{tally(memberRows, m.workspace.id)}</td>
                    <td className="num ws-switch-cell">
                      {active ? <span className="ws-active-badge">{t('Active')}</span>
                        : <form action={switchWorkspace.bind(null, m.workspace.id, '/workspaces')}><button type="submit" className="btn">{t('Switch')}</button></form>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="detail-block" id="members">
        <div className="section-head">
          <h2>{t('Team members')} {teams && <span className="uc-count">{members.length}</span>}</h2>
          {ctx.canAddMembers && <AddMemberButton workspaceId={activeId} />}
        </div>
        {teams ? (
          <ul className="member-list">
            {members.map((m) => (
              <MemberRow key={m.userId} workspaceId={activeId} member={m} canManage={ctx.isAdmin}
                isSelf={m.userId === user.id} isOwner={m.userId === ctx.workspace.ownerId} />
            ))}
          </ul>
        ) : (
          <div className="profile-empty">
            <p className="profile-empty-title">{t('Add team members to your workspace')}</p>
            <Link href="/settings/account?plan=1" className="btn primary profile-empty-cta">{t('Upgrade Plan')}</Link>
          </div>
        )}
      </section>
    </div>
  );
}
