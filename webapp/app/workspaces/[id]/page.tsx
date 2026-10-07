import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getContext, getMyWorkspaces, getWorkspaceContext } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { SCOPE_AGENT_KEYS, getWorkspaceScopes } from '@/lib/scopes';
import ScopeCard from '@/components/settings/ScopeCard';
import { AddMemberButton, DeleteWorkspace, MemberRow, RevokeInviteButton, WorkspaceName } from '@/components/settings/WorkspaceControls';
import { createScope, switchWorkspace } from '../actions';
import { UpgradeReport } from '@/components/UpgradeReport';
import SignUpGate from '@/components/SignUpGate';
import { getLocale, getT } from '@/lib/i18n/server';

const fmt = (iso: string) => new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

/** One workspace: its scopes and its team members (Teams). */
export default async function WorkspaceDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    const t = await getT();
    return (
      <div className="settings">
        <h1 className="opps-h1">{t('Workspaces')}</h1>
        <SignUpGate />
      </div>
    );
  }
  const ctx = await getWorkspaceContext(params.id);
  if (!ctx) notFound();
  const t = await getT();
  const db = getSupabaseServerClient();
  const wsId = ctx.workspace.id;
  const ownScopes = await getWorkspaceScopes(wsId);
  const { data: wsRow } = await db.from('workspaces').select('show_default').eq('id', wsId).maybeSingle();
  const otherActive = ownScopes.some((s) => s.active && !s.isDefault);
  const showDefault = wsRow?.show_default !== false || !otherActive;
  const { data: defaultRow } = await db.from('scopes').select('*').eq('is_default', true).maybeSingle();
  const sharedDefault = defaultRow?.active && defaultRow.workspace_id !== wsId ? {
    id: defaultRow.id, ownerId: defaultRow.owner_id, name: defaultRow.name, instructions: defaultRow.instructions,
    active: defaultRow.active, isDefault: true, searchScope: defaultRow.search_scope, searchConfig: defaultRow.search_config,
    searchStatus: defaultRow.search_status, searchError: defaultRow.search_error, parsedAt: defaultRow.search_parsed_at, createdAt: defaultRow.created_at,
  } : null;
  const scopes = sharedDefault ? [sharedDefault, ...ownScopes] : ownScopes;
  const ids = scopes.map((s) => s.id);
  const teams = ctx.plan.key === 'teams';
  const [mine, current, { data: docs }, { data: agentRows }, { data: items }, { data: memberRows }, { data: invites }] = await Promise.all([
    getMyWorkspaces(),
    getContext(),
    ids.length ? db.from('company_documents').select('scope_id').in('scope_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('scope_agent_settings').select('scope_id, agent_key, enabled').in('scope_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('scope_items').select('scope_id').in('scope_id', ids).limit(50000) : Promise.resolve({ data: [] as any[] }),
    db.from('workspace_members').select('user_id, role').eq('workspace_id', wsId),
    ctx.canAddMembers
      ? db.from('account_invites').select('id, email, role, expires_at').eq('workspace_id', wsId).is('accepted_at', null).gt('expires_at', new Date().toISOString())
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const { data: profiles } = await db.from('profiles').select('id, username, display_name, avatar_url').in('id', (memberRows || []).map((m: any) => m.user_id));
  const members = (memberRows || []).map((m: any) => {
    const p = (profiles || []).find((x: any) => x.id === m.user_id);
    return { userId: m.user_id, role: m.role, username: p?.username ?? 'user', displayName: p?.display_name || p?.username || 'user', avatarUrl: p?.avatar_url ?? null };
  }).sort((a, b) => Number(b.userId === ctx.workspace.ownerId) - Number(a.userId === ctx.workspace.ownerId)
    || (a.role === b.role ? a.username.localeCompare(b.username) : a.role === 'admin' ? -1 : 1));

  const count = (rows: any[] | null, id: string) => (rows || []).filter((r) => r.scope_id === id).length;
  const plan = ctx.plan;
  const limit = ctx.isDefault ? Infinity : plan.scopes;
  const customCount = ownScopes.filter((s) => !s.isDefault).length;
  const canAdd = ctx.canCustomize && customCount < limit;
  const owned = mine.filter((m) => m.workspace.ownerId === user.id && !m.isDefault);
  const addScope = createScope.bind(null, wsId);
  const onSite = current?.workspace.id === wsId;

  return (
    <div className="settings">
      <Link className="back-link" href="/workspaces">← {t('Workspaces')}</Link>
      <div className="community-head">
        <div>
          <WorkspaceName id={wsId} name={ctx.workspace.name} canRename={ctx.isAdmin} />
        </div>
        <div className="ws-head-actions">
          {onSite ? <span className="ws-active-badge">{t('Active workspace')}</span>
            : <form action={switchWorkspace.bind(null, wsId, `/workspaces/${wsId}`)}><button type="submit" className="btn primary">{t('Switch to this workspace')}</button></form>}
        </div>
      </div>

      {!ctx.isAdmin && <p className="callout">{t('View only — admins configure this workspace.')}</p>}
      {ctx.isAdmin && !ctx.canCustomize && (
        <p className="callout">
          {t('Free plan: default scope only.')}{ctx.isOwner && <> <Link href="/settings/account?plan=1">{t('Upgrade')}</Link> {t('to create your own.')}</>}
        </p>
      )}

      {/* ---------- Scopes ---------- */}
      <section className="detail-block" id="scopes">
        <div className="section-head">
          <h2>{t('Scopes')} <span className="uc-count">{scopes.length}{Number.isFinite(limit) && plan.customize ? `/${limit}` : ''}</span></h2>
          {canAdd && scopes.length > 0 && <form action={addScope}><button type="submit" className="btn primary">{t('New scope')}</button></form>}
        </div>
        {scopes.length === 0 ? (
          <div className="profile-empty">
            <p className="profile-empty-title">{t('No scopes in this workspace')}</p>
            {canAdd ? <form action={addScope}><button type="submit" className="btn primary profile-empty-cta">{t('Create the first scope')}</button></form>
              : ctx.isAdmin && <Link href="/settings/account?plan=1" className="btn primary profile-empty-cta">{t('See plans')}</Link>}
          </div>
        ) : (
          <div className="scope-grid">
            {scopes.map((s) => {
              const on = SCOPE_AGENT_KEYS.filter((k) => (agentRows || []).find((r: any) => r.scope_id === s.id && r.agent_key === k)?.enabled ?? true).length;
              const isDefaultCard = s.isDefault;
              return (
                <ScopeCard key={s.id} readOnly={isDefaultCard ? !ctx.isPlatformAdmin : !ctx.canCustomize}
                  canToggle={isDefaultCard ? ctx.isAdmin && otherActive : undefined}
                  showDefaultFor={isDefaultCard ? wsId : null}
                  scope={{ id: s.id, name: s.name, instructions: s.instructions, active: isDefaultCard ? showDefault : s.active, isDefault: s.isDefault, topic: s.searchConfig?.topic ?? null }}
                  docs={count(docs, s.id)} agentsOn={on} agentsTotal={SCOPE_AGENT_KEYS.length} items={count(items, s.id)} />
              );
            })}
          </div>
        )}
        {ctx.canCustomize && !canAdd && Number.isFinite(limit) && (
          <p className="field-hint">{t('Scope limit reached.')}{ctx.isOwner && <> <Link href="/settings/account?plan=1">{t('Upgrade')}</Link></>}</p>
        )}
      </section>

      {/* ---------- Team members ---------- */}
      <section className="detail-block" id="members">
        <div className="section-head">
          <h2>{t('Team members')} {teams && <span className="uc-count">{members.length}</span>}</h2>
          {ctx.canAddMembers && <AddMemberButton workspaceId={wsId} />}
        </div>
        {teams ? (
          <>
            <ul className="member-list">
              {members.map((m) => (
                <MemberRow key={m.userId} workspaceId={wsId} member={m} canManage={ctx.isAdmin}
                  isSelf={m.userId === user.id} isOwner={m.userId === ctx.workspace.ownerId} />
              ))}
            </ul>
            {(invites || []).length > 0 && (
              <ul className="member-list invites">
                {(invites || []).map((i: any) => (
                  <li key={i.id} className="member-row">
                    <span className="member-who"><strong>{i.email || t('Anyone with the link')}</strong><em>{t('Invited')} · {i.role === 'admin' ? t('admin') : t('member')} · {t('expires {date}', { date: fmt(i.expires_at) })}</em></span>
                    <RevokeInviteButton id={i.id} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <UpgradeReport />
        )}
      </section>

      {ctx.isOwner && (
        <section className="detail-block danger-zone" id="delete">
          <h2>{t('Delete workspace')}</h2>
          <DeleteWorkspace id={wsId} name={ctx.workspace.name}
            blocked={ctx.isDefault ? t('This workspace holds the default scope, so it can’t be deleted.')
              : owned.length <= 1 ? t('This is your only workspace — create another before deleting it.') : null} />
        </section>
      )}
    </div>
  );
}
