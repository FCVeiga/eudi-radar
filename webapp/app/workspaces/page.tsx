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
import { NewWorkspaceButton } from '@/components/settings/WorkspaceControls';
import { WorkspaceMark } from '@/components/WorkspaceSwitcher';
import { switchWorkspace } from './actions';
import { getT } from '@/lib/i18n/server';

// The Config Agent runs inside the workspace agents' server actions: give it time.
export const maxDuration = 300;
export async function generateMetadata() {
  const t = await getT();
  return { title: `${t('Workspaces')} — Tender Town` };
}

/** Workspace: your workspaces (each opens its scopes and members) and the shared workspace agents. Plans are on Settings. */
export default async function WorkspacesPage({ searchParams }: { searchParams: { new?: string } }) {
  const user = await getCurrentUser();
  const ctx = await getContext();
  if (!user || !ctx) redirect('/login?next=/workspaces');
  const t = await getT();
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
                    <td className="num">{tally(scopeRows, m.workspace.id)}</td>
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

      {/* ---------- Workspace agents ---------- */}
      <section className="detail-block" id="workspace-agents">
        <h2>{t('Workspace agents')}</h2>
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
