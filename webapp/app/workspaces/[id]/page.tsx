import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getContext, getMyWorkspaces, getWorkspaceContext } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { SCOPE_AGENT_KEYS, getWorkspaceScopes } from '@/lib/scopes';
import ScopeCard from '@/components/settings/ScopeCard';
import { AddMemberButton, MemberRow, RevokeInviteButton, WorkspaceName } from '@/components/settings/WorkspaceControls';
import { createScope, switchWorkspace } from '../actions';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** One workspace: its scopes and its team members (Teams). */
export default async function WorkspaceDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/workspace/${params.id}`);
  const ctx = await getWorkspaceContext(params.id);
  if (!ctx) notFound();
  const db = getSupabaseServerClient();
  const wsId = ctx.workspace.id;
  const scopes = await getWorkspaceScopes(wsId);
  const ids = scopes.map((s) => s.id);
  const teams = ctx.plan.key === 'teams';
  const [mine, current, { data: docs }, { data: agentRows }, { data: items }, { data: defaultScope }, { data: memberRows }, { data: invites }] = await Promise.all([
    getMyWorkspaces(),
    getContext(),
    ids.length ? db.from('company_documents').select('scope_id').in('scope_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('scope_agent_settings').select('scope_id, agent_key, enabled').in('scope_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('scope_items').select('scope_id').in('scope_id', ids).limit(50000) : Promise.resolve({ data: [] as any[] }),
    db.from('scopes').select('name').eq('is_default', true).maybeSingle(),
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
  const canAdd = ctx.canCustomize && scopes.length < limit;
  const owned = mine.filter((m) => m.workspace.ownerId === user.id && !m.isDefault);
  const addScope = createScope.bind(null, wsId);
  const onSite = current?.workspace.id === wsId;

  return (
    <div className="settings">
      <Link className="back-link" href="/workspaces">← Workspaces</Link>
      <div className="community-head">
        <div>
          <WorkspaceName id={wsId} name={ctx.workspace.name} canRename={ctx.isAdmin}
            canDelete={ctx.isOwner && !ctx.isDefault && owned.length > 1} />
        </div>
        <div className="ws-head-actions">
          {!onSite && <form action={switchWorkspace.bind(null, wsId, '/')}><button type="submit" className="btn">Show its results</button></form>}
        </div>
      </div>

      {!ctx.isAdmin && <p className="callout">View only — admins configure this workspace.</p>}
      {ctx.isAdmin && !ctx.canCustomize && (
        <p className="callout">
          Free plan: default scope only.{ctx.isOwner && <> <Link href="/settings#billing">Upgrade</Link> to create your own.</>}
        </p>
      )}

      {/* ---------- Scopes ---------- */}
      <section className="detail-block" id="scopes">
        <div className="section-head">
          <h2>Scopes <span className="uc-count">{scopes.length}{Number.isFinite(limit) && plan.customize ? `/${limit}` : ''}</span></h2>
          {canAdd && scopes.length > 0 && <form action={addScope}><button type="submit" className="btn primary">New scope</button></form>}
        </div>
        {scopes.length === 0 ? (
          <div className="profile-empty">
            <p className="profile-empty-title">No scopes in this workspace</p>
            {canAdd ? <form action={addScope}><button type="submit" className="btn primary profile-empty-cta">Create the first scope</button></form>
              : ctx.isAdmin && <Link href="/settings#billing" className="btn primary profile-empty-cta">See plans</Link>}
          </div>
        ) : (
          <div className="scope-grid">
            {scopes.map((s) => {
              const on = SCOPE_AGENT_KEYS.filter((k) => (agentRows || []).find((r: any) => r.scope_id === s.id && r.agent_key === k)?.enabled ?? true).length;
              return (
                <ScopeCard key={s.id} readOnly={!ctx.canCustomize}
                  scope={{ id: s.id, name: s.name, instructions: s.instructions, active: s.active, isDefault: s.isDefault, topic: s.searchConfig?.topic ?? null }}
                  docs={count(docs, s.id)} agentsOn={on} agentsTotal={SCOPE_AGENT_KEYS.length} items={count(items, s.id)} />
              );
            })}
          </div>
        )}
        {ctx.canCustomize && !canAdd && Number.isFinite(limit) && (
          <p className="field-hint">Scope limit reached.{ctx.isOwner && <> <Link href="/settings#billing">Upgrade</Link></>}</p>
        )}
      </section>

      {/* ---------- Team members (Teams) ---------- */}
      {(teams || members.length > 1) && (
        <section className="detail-block" id="members">
          <div className="section-head">
            <h2>Team members <span className="uc-count">{members.length}</span></h2>
            {ctx.canAddMembers && <AddMemberButton workspaceId={wsId} />}
          </div>
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
                  <span className="member-who"><strong>{i.email || 'Anyone with the link'}</strong><em>Invited · {i.role === 'admin' ? 'admin' : 'member'} · expires {fmt(i.expires_at)}</em></span>
                  <RevokeInviteButton id={i.id} />
                </li>
              ))}
            </ul>
          )}
          {!teams && ctx.isOwner && <p className="callout">Adding team members needs the Teams plan.</p>}
        </section>
      )}

    </div>
  );
}
