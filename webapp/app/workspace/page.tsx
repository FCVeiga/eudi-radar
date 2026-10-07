import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AGENTS } from '@/lib/agents';
import { getCurrentUser } from '@/lib/auth';
import { getContext, getMyWorkspaces, getPersonalAccount } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { billingReady } from '@/lib/billing';
import { PLATFORM_AGENT_KEYS, SCOPE_AGENT_KEYS, getWorkspaceScopes } from '@/lib/scopes';
import { getAgentDefaults } from '@/lib/settings';
import AgentCard from '@/components/settings/AgentCard';
import ScopeCard from '@/components/settings/ScopeCard';
import {
  InviteForm, MemberRow, NewWorkspaceForm, PlanButton, PortalButton, RevokeInviteButton, SetPlan, WorkspaceName,
} from '@/components/settings/WorkspaceControls';
import { createScope, switchWorkspace } from './actions';

// The Config Agent runs inside the agents' server actions: give it time.
export const maxDuration = 300;
export const metadata = { title: 'Workspace — EUDI Radar' };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Workspace: the current workspace's scopes, its team members (Teams), your
 * workspaces, your plan, and the shared workspace agents.
 */
export default async function WorkspacePage({ searchParams }: { searchParams: { billing?: string } }) {
  const user = await getCurrentUser();
  const ctx = await getContext();
  if (!user || !ctx) redirect('/login?next=/workspace');
  const db = getSupabaseServerClient();
  const wsId = ctx.workspace.id;
  const scopes = await getWorkspaceScopes(wsId);
  const ids = scopes.map((s) => s.id);
  const teams = ctx.plan.key === 'teams';
  const [agentDefaults, mine, account, { data: docs }, { data: agentRows }, { data: items }, { data: defaultScope }, { data: memberRows }, { data: invites }] = await Promise.all([
    getAgentDefaults(),
    getMyWorkspaces(),
    getPersonalAccount(user.id),
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
  const runs = ctx.isDefault ? 1 : plan.runsPerDay;
  const owned = mine.filter((m) => m.workspace.ownerId === user.id && !m.isDefault);
  const myPlan = account?.plan ?? PLANS[0];
  const canCreateWs = myPlan.workspaces === null || owned.length < myPlan.workspaces;
  const ownerNote = ctx.isOwner ? '' : ` · shared by u/${ctx.owner.username}`;

  return (
    <div className="settings">
      <div className="community-head">
        <div>
          <WorkspaceName id={wsId} name={ctx.workspace.name} canRename={ctx.isAdmin}
            canDelete={ctx.isOwner && !ctx.isDefault && owned.length > 1} />
          <p className="ws-sub">{ctx.isDefault ? 'Default scope' : `${plan.name} plan`}{ownerNote} · you’re {ctx.isAdmin ? 'an admin' : 'a member'}</p>
        </div>
        {canAdd && <form action={createScope}><button type="submit" className="btn primary">+ New scope</button></form>}
      </div>

      {searchParams.billing === 'success' && <p className="form-msg ok">Thanks — your plan is being activated. It can take a few seconds to show here.</p>}
      {!ctx.isAdmin && <p className="callout">You’re a member of this workspace: you see its agents’ results. Its admins configure the scopes.</p>}
      {ctx.isAdmin && !ctx.canCustomize && (
        <p className="callout">
          On the Free plan you follow the default scope — {defaultScope?.name ?? 'EUDI Wallet & digital identity'} — updated once a day.
          <a href="#plan"> Upgrade</a> to create your own scopes with your instructions, context and agents.
        </p>
      )}

      {/* ---------- Scopes ---------- */}
      <section className="detail-block" id="scopes">
        <h2>Scopes <span className="uc-count">{scopes.length}{Number.isFinite(limit) && plan.customize ? `/${limit}` : ''}</span></h2>
        <p className="settings-intro">
          A scope is one configuration of the radar — for a company, a department or a project: its instructions, context
          documents, search and agents. Home, Community, Tenders, News and History show the results of this workspace’s active
          scopes together. Agents update them {runs === 1 ? 'once' : runs === 2 ? 'twice' : `${runs} times`} a day.
        </p>
        {scopes.length === 0 ? (
          <div className="profile-empty">
            <p className="profile-empty-title">No scopes in this workspace</p>
            <p className="muted">Until there is one, it shows the default scope ({defaultScope?.name ?? 'EUDI Wallet & digital identity'}).</p>
            {canAdd ? <form action={createScope}><button type="submit" className="btn primary profile-empty-cta">Create the first scope</button></form>
              : ctx.isAdmin && <a href="#plan" className="btn primary profile-empty-cta">See plans</a>}
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
          <p className="field-hint">You’ve reached the {plan.name} plan’s {limit} {limit === 1 ? 'scope' : 'scopes'}.{ctx.isOwner && <> <a href="#plan">Upgrade</a> for more.</>}</p>
        )}
      </section>

      {/* ---------- Team members (Teams) ---------- */}
      {(teams || members.length > 1) && (
        <section className="detail-block" id="members">
          <h2>Team members <span className="uc-count">{members.length}</span></h2>
          <p className="settings-intro">Admins configure this workspace’s scopes and agents; members see the results.</p>
          <ul className="member-list">
            {members.map((m) => (
              <MemberRow key={m.userId} workspaceId={wsId} member={m} canManage={ctx.isAdmin}
                isSelf={m.userId === user.id} isOwner={m.userId === ctx.workspace.ownerId} />
            ))}
          </ul>
          {ctx.canAddMembers && (
            <>
              <h3 className="form-subhead">Add people</h3>
              <InviteForm workspaceId={wsId} />
              {(invites || []).length > 0 && (
                <ul className="member-list invites">
                  {(invites || []).map((i: any) => (
                    <li key={i.id} className="member-row">
                      <span className="member-who"><strong>{i.email || 'Anyone with the link'}</strong><em>Invited as {i.role === 'admin' ? 'admin' : 'member'} · expires {fmt(i.expires_at)}</em></span>
                      <RevokeInviteButton id={i.id} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {!teams && ctx.isOwner && <p className="callout">Adding team members needs the Teams plan.</p>}
        </section>
      )}

      {/* ---------- Your workspaces ---------- */}
      <section className="detail-block" id="workspaces">
        <h2>Your workspaces <span className="uc-count">{mine.length}</span></h2>
        <p className="settings-intro">Each workspace has its own scopes and people. The whole site shows the workspace you’re in — switch here or from your account menu.</p>
        <ul className="ws-list">
          {mine.map((m) => {
            const current = m.workspace.id === wsId;
            return (
              <li key={m.workspace.id} className="ws-row">
                <span className="member-who">
                  <strong>{m.workspace.name}{current ? ' · current' : ''}</strong>
                  <em>{m.workspace.ownerId === user.id ? 'Yours' : `Shared by u/${m.owner.username}`} · {m.role === 'admin' ? 'Admin' : 'Member'}</em>
                </span>
                {!current && <form action={switchWorkspace.bind(null, m.workspace.id, '/workspace')}><button type="submit" className="btn">Open</button></form>}
              </li>
            );
          })}
        </ul>
        <div id="new">
          {canCreateWs ? <NewWorkspaceForm />
            : <p className="field-hint">The {myPlan.name} plan has one workspace. <a href="#plan">Teams</a> has unlimited workspaces, each with its own members.</p>}
        </div>
      </section>

      {/* ---------- Your plan ---------- */}
      <section className="detail-block" id="plan">
        <h2>Your plan</h2>
        <p className="settings-intro">
          You’re on the <strong>{myPlan.name}</strong> plan
          {account?.planStatus === 'comped' ? ' (complimentary)' : account && account.planStatus !== 'active' ? ` (${account.planStatus.replace('_', ' ')})` : ''}
          {account?.periodEnd ? ` · renews ${fmt(account.periodEnd)}` : ''}. It applies to the workspaces you own.
          {!billingReady() && ' Online payments aren’t switched on yet — contact us to change plans.'}
        </p>
        <div className="plan-grid">
          {PLANS.map((p) => {
            const current = myPlan.key === p.key;
            return (
              <div key={p.key} className={`plan-card ${current ? 'current' : ''}`}>
                <div className="plan-head"><h3>{p.name}</h3>{current && <span className="scope-badge">Current</span>}</div>
                <p className="plan-price">€{p.priceEur}<span>/month</span></p>
                <p className="plan-blurb">{p.blurb}</p>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                {!current && p.key !== 'free' && <PlanButton plan={p.key} label={`Choose ${p.name}`} />}
              </div>
            );
          })}
        </div>
        <div className="billing-actions">
          {account?.stripeCustomerId && <PortalButton />}
          {ctx.isPlatformAdmin && <SetPlan userId={user.id} plan={myPlan.key} options={PLANS.map((p) => ({ key: p.key, name: p.name }))} />}
        </div>
      </section>

      {/* ---------- Workspace agents ---------- */}
      <section className="detail-block" id="workspace-agents">
        <h2>Workspace agents</h2>
        <p className="settings-intro">
          These agents work on the data every workspace shares — a tender’s documents and requirements, the feed’s posts,
          and translation into the site’s language. They’re managed for you.
        </p>
        <div className="agent-grid">
          {AGENTS.filter((a) => PLATFORM_AGENT_KEYS.includes(a.key)).map((a) => {
            const s = agentDefaults.get(a.key);
            return (
              <AgentCard key={a.key} agent={a} enabled={s?.enabled ?? true} instructions={s?.instructions ?? null} readOnly={!ctx.isPlatformAdmin}
                config={a.fineTune ? s?.prompt_override || s?.default_prompt || null : null} custom={!!s?.prompt_override}
                status={s?.status ?? null} error={s?.error ?? null} />
            );
          })}
        </div>
      </section>
    </div>
  );
}
