import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, siteOrigin } from '@/lib/auth';
import { mcpConnectPrompt } from '@/lib/mcp/guide';
import McpLink from '@/components/workspaces/McpPrompt';
import { maskMcpToken, mcpLinksForUser } from '@/lib/mcpTokens';
import { getContext, getMyWorkspaces, getPersonalAccount, isPlatformAdmin } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { NewWorkspaceButton } from '@/components/settings/WorkspaceControls';
import { WorkspaceMark } from '@/components/WorkspaceSwitcher';
import { switchWorkspace } from './actions';
import { getT } from '@/lib/i18n/server';
import { NOINDEX } from '@/lib/seo';
import SignUpGate from '@/components/SignUpGate';
import { PlanUpgradeButton } from '@/components/settings/PlanPanel';

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t('Workspaces')} — Tender Town`, ...NOINDEX };
}

/** Workspace list. Members live on each workspace page, under its scopes. */
export default async function WorkspacesPage({ searchParams }: { searchParams: { new?: string } }) {
  const user = await getCurrentUser();
  const t = await getT();
  if (!user) {
    return (
      <div className="settings">
        <h1 className="opps-h1">{t('Workspaces')}</h1>
        <SignUpGate />
      </div>
    );
  }
  const ctx = await getContext();
  if (!ctx) redirect('/login?next=/workspaces');
  const db = getSupabaseServerClient();
  const [mine, account, admin] = await Promise.all([getMyWorkspaces(), getPersonalAccount(user.id), isPlatformAdmin()]);
  const wsIds = mine.map((m) => m.workspace.id);
  const [{ data: scopeRows }, { data: memberRows }, { count: catalogCount }] = await Promise.all([
    db.from('scopes').select('workspace_id, is_default, catalog').in('workspace_id', wsIds),
    db.from('workspace_members').select('workspace_id').in('workspace_id', wsIds),
    db.from('scopes').select('id', { count: 'exact', head: true }).eq('catalog', true).eq('active', true),
  ]);
  const tally = (rows: any[] | null, id: string) => (rows || []).filter((r) => r.workspace_id === id).length;
  const scopeCount = (id: string) => {
    const own = (scopeRows || []).filter((r) => r.workspace_id === id && !r.is_default && !r.catalog).length;
    return 1 + (catalogCount ?? 0) + own;
  };
  const myPlan = account?.plan ?? PLANS[0];
  const teams = myPlan.key === 'teams';
  const origin = siteOrigin();
  const link = await mcpLinksForUser(user.id);
  const linkTokens = 'error' in link ? [] : link.map((tk) => ({
    id: tk.id, name: tk.name, hint: maskMcpToken(tk.token), prompt: mcpConnectPrompt(t, origin, tk.token),
  }));
  const linkError = 'error' in link ? t(link.error) : null;

  return (
    <div className="settings">
      <h1 className="opps-h1">{t('Workspaces')}</h1>

      {/* ---------- Your workspaces ---------- */}
      <section className="detail-block" id="workspaces">
        <div className="section-head">
          <h2>{t('Your workspaces')} <span className="uc-count">{mine.length}</span></h2>
          {teams ? <NewWorkspaceButton autoOpen={searchParams.new === '1'} /> : (
            <PlanUpgradeButton label={t('New workspace')} autoOpen={searchParams.new === '1'} userId={user.id} admin={admin}
              plan={{ key: account?.planKey ?? 'free', status: account?.planStatus ?? 'active', periodEnd: account?.periodEnd ?? null, hasBilling: !!account?.stripeCustomerId }} />
          )}
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

      <section className="detail-block" id="mcp">
        <div className="mcp-card">
          <div className="mcp-card-head">
            <h2>{t('Remote MCP')}</h2>
            <p className="mcp-docs"><Link href="/mcp">{t('Documentation')}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5 11.5 4.5M6.5 4.5h5v5" /></svg></Link></p>
          </div>
          <p className="mcp-lead">{t('Copy the link into your agent. It includes this access token and acts as you, inside your plan.')}</p>
          <p className="mcp-label">{t('Access token')}</p>
          <McpLink tokens={linkTokens} error={linkError} />
        </div>
      </section>
    </div>
  );
}
