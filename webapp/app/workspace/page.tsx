import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AGENTS } from '@/lib/agents';
import { getCurrentUser } from '@/lib/auth';
import { getContext, getMyWorkspaces, getPersonalAccount } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { PLATFORM_AGENT_KEYS } from '@/lib/scopes';
import { getAgentDefaults } from '@/lib/settings';
import AgentCard from '@/components/settings/AgentCard';
import { NewWorkspaceForm } from '@/components/settings/WorkspaceControls';

// The Config Agent runs inside the workspace agents' server actions: give it time.
export const maxDuration = 300;
export const metadata = { title: 'Workspace — EUDI Radar' };

/** Workspace: your workspaces (each opens its scopes and members) and the shared workspace agents. Plans are on Settings. */
export default async function WorkspacePage() {
  const user = await getCurrentUser();
  const ctx = await getContext();
  if (!user || !ctx) redirect('/login?next=/workspace');
  const db = getSupabaseServerClient();
  const [agentDefaults, mine, account] = await Promise.all([getAgentDefaults(), getMyWorkspaces(), getPersonalAccount(user.id)]);
  const wsIds = mine.map((m) => m.workspace.id);
  const [{ data: scopeRows }, { data: memberRows }] = await Promise.all([
    db.from('scopes').select('workspace_id').in('workspace_id', wsIds),
    db.from('workspace_members').select('workspace_id').in('workspace_id', wsIds),
  ]);
  const tally = (rows: any[] | null, id: string) => (rows || []).filter((r) => r.workspace_id === id).length;
  const owned = mine.filter((m) => m.workspace.ownerId === user.id && !m.isDefault);
  const myPlan = account?.plan ?? PLANS[0];
  const canCreateWs = myPlan.workspaces === null || owned.length < myPlan.workspaces;

  return (
    <div className="settings">
      <h1 className="opps-h1">Workspace</h1>

      {/* ---------- Your workspaces ---------- */}
      <section className="detail-block" id="workspaces">
        <h2>Your workspaces <span className="uc-count">{mine.length}</span></h2>
        <p className="settings-intro">Each workspace has its own scopes and team members — open one to manage them. The site shows one workspace’s results at a time; switch from your account menu.</p>
        <div className="table-wrap">
          <table className="data-table ws-table">
            <thead><tr><th>Workspace</th><th>Owner</th><th>Your role</th><th className="num">Scopes</th><th className="num">Members</th></tr></thead>
            <tbody>
              {mine.map((m) => {
                const href = `/workspace/${m.workspace.id}`;
                return (
                  <tr key={m.workspace.id}>
                    <td><Link href={href} className="ws-table-name">{m.workspace.name}</Link>{m.workspace.id === ctx.workspace.id && <span className="scope-badge">On the site</span>}</td>
                    <td>{m.workspace.ownerId === user.id ? 'You' : `u/${m.owner.username}`}</td>
                    <td>{m.role === 'admin' ? 'Admin' : 'Member'}</td>
                    <td className="num">{tally(scopeRows, m.workspace.id)}</td>
                    <td className="num">{tally(memberRows, m.workspace.id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div id="new">
          {canCreateWs ? <NewWorkspaceForm />
            : <p className="field-hint">The {myPlan.name} plan has one workspace. <Link href="/settings#billing">Teams</Link> has unlimited workspaces, each with its own members.</p>}
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
