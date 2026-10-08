import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AGENTS } from '@/lib/agents';
import { getCurrentUser } from '@/lib/auth';
import { SCOPE_AGENT_KEYS, getScopeAgents, getViewableScope } from '@/lib/scopes';
import { getContext, getPersonalAccount, getWorkspaceContext } from '@/lib/accounts';
import { DOC_KINDS, getAgentDefaults, getScopeDocs } from '@/lib/settings';
import AgentCard from '@/components/settings/AgentCard';
import ScopeCard from '@/components/settings/ScopeCard';
import { DeleteScopeForm, DocumentGroup, ScopeForm } from '@/components/settings/SettingsForms';
import FollowingSection from '@/components/settings/FollowingSection';
import { getCountryOptions, getFollowedSourceIds, getSources } from '@/lib/sources';
import { getT } from '@/lib/i18n/server';
import { newsReportAllowance } from '@/lib/newsQuota';

// The Config Agent runs inside this page's server actions: give it time.
export const maxDuration = 300;

/** One scope: name and instructions, context documents, and its agents. */
export default async function ScopePage({ params, searchParams }: { params: { id: string }; searchParams: { from?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/workspaces/scopes/${params.id}`);
  const scope = await getViewableScope(params.id);
  if (!scope) notFound();
  const from = searchParams.from && /^[0-9a-f-]{36}$/.test(searchParams.from) ? searchParams.from : null;
  const back = from && await getWorkspaceContext(from) ? `/workspaces/${from}` : '/workspaces';
  const locked = !scope.editable;
  const shared = scope.isDefault || scope.catalog;
  const ctx = await getContext();
  const docWorkspace = shared ? ctx?.workspace.id ?? null : null;
  const docsEditable = shared ? !!ctx?.isAdmin && !!docWorkspace : !locked;
  const account = await getPersonalAccount(user.id);
  const viewerPlan = { key: account?.planKey ?? 'free', status: account?.planStatus ?? 'active', periodEnd: account?.periodEnd ?? null, hasBilling: !!account?.stripeCustomerId };
  const upgrade = { userId: user.id, admin: !!ctx?.isPlatformAdmin, plan: viewerPlan };
  const t = await getT();
  const [agents, defaults, docs, sources, countries, allowance] = await Promise.all([
    getScopeAgents(scope.id), getAgentDefaults(), getScopeDocs(scope.id, docWorkspace), getSources(), getCountryOptions(), newsReportAllowance(),
  ]);
  const followed = Array.from(await getFollowedSourceIds([scope.id]));
  const cfg = scope.searchConfig;

  return (
    <div className="settings">
      <Link className="back-link" href={back}>← {t('Workspace')}</Link>
      <div className="scope-page-head">
        <h1 className="opps-h1">{scope.name}</h1>
        {!scope.isDefault && !scope.catalog && (
          <div className="scope-page-switch">
            <ScopeCard scope={{ id: scope.id, name: scope.name, instructions: scope.instructions, active: scope.active, isDefault: scope.isDefault, catalog: scope.catalog, topic: cfg?.topic ?? null }}
              docs={docs.length} agentsOn={SCOPE_AGENT_KEYS.filter((k) => agents.get(k)?.enabled ?? true).length} agentsTotal={SCOPE_AGENT_KEYS.length} items={0}
              readOnly={locked} canToggle={!locked} />
          </div>
        )}
      </div>

      <section className="detail-block" id="scope">
        <h2>{t('Scope')}</h2>
        {locked
          ? <p className="scope-readonly-text">{scope.instructions || t('No instructions yet.')}</p>
          : <ScopeForm scopeId={scope.id} name={scope.name} instructions={scope.instructions ?? ''} />}
      </section>

      <section className="detail-block" id="context">
        <h2>{t('Scope context')}</h2>
        {DOC_KINDS.map((k) => (
          <DocumentGroup key={k.kind} scopeId={scope.id} workspaceId={docWorkspace} kind={k.kind} label={k.label} hint={k.hint} docs={docs.filter((d) => d.kind === k.kind)} readOnly={!docsEditable} />
        ))}
        {docsEditable && <p className="field-hint">{t('PDF, Word, PowerPoint, Excel or text · up to 50 MB · private')}</p>}
      </section>

      <section className="detail-block" id="agents">
        <h2>{t('Agents')}</h2>
        <div className="agent-grid">
          {AGENTS.filter((a) => SCOPE_AGENT_KEYS.includes(a.key)).map((a) => {
            const s = agents.get(a.key);
            const planLocked = (a.key === 'news_report' && allowance.block === 'plan')
              || (a.key === 'tender_evaluation' && (ctx?.plan.evaluationsPerMonth ?? 0) === 0)
              || (a.key === 'proposal_manager' && (ctx?.plan.proposalsPerMonth ?? 0) === 0);
            if (a.key === 'search') {
              return (
                <AgentCard key={a.key} scopeId={scope.id} agent={a} enabled={s?.enabled ?? true} instructions={scope.searchScope}
                  config={cfg ? JSON.stringify(cfg, null, 2) : defaults.get('search')?.default_prompt ?? null} custom={!!cfg}
                  status={scope.searchStatus} error={scope.searchError} readOnly={locked} upgrade={upgrade} />
              );
            }
            return (
              <AgentCard key={a.key} scopeId={scope.id} agent={a} enabled={planLocked ? false : (s?.enabled ?? true)} instructions={s?.instructions ?? null}
                config={s?.prompt_override || defaults.get(a.key)?.default_prompt || null} custom={!!s?.prompt_override}
                status={s?.status ?? null} error={s?.error ?? null} locked={planLocked} readOnly={locked} upgrade={upgrade} />
            );
          })}
        </div>
      </section>

      <FollowingSection scopeId={scope.id} sources={sources} followed={followed} countries={countries} readOnly={locked} />

      {scope.editable && !scope.isDefault && !scope.catalog && (
        <section className="detail-block danger-zone">
          <h2>{t('Delete scope')}</h2>
          <DeleteScopeForm scopeId={scope.id} name={scope.name} />
        </section>
      )}
    </div>
  );
}
