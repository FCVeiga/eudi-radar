import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AGENTS } from '@/lib/agents';
import { getCurrentUser } from '@/lib/auth';
import { SCOPE_AGENT_KEYS, getEditableScope, getScopeAgents } from '@/lib/scopes';
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
export default async function ScopePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/workspaces/scopes/${params.id}`);
  const scope = await getEditableScope(params.id);
  if (!scope) notFound();
  const t = await getT();
  const [agents, defaults, docs, sources, countries, allowance] = await Promise.all([
    getScopeAgents(scope.id), getAgentDefaults(), getScopeDocs(scope.id), getSources(), getCountryOptions(), newsReportAllowance(),
  ]);
  const followed = Array.from(await getFollowedSourceIds([scope.id]));
  const cfg = scope.searchConfig;

  return (
    <div className="settings">
      <Link className="back-link" href={`/workspaces/${scope.workspaceId}`}>← {t('Workspace')}</Link>
      <div className="scope-page-head">
        <h1 className="opps-h1">{scope.name}</h1>
        <div className="scope-page-switch">
          <ScopeCard scope={{ id: scope.id, name: scope.name, instructions: scope.instructions, active: scope.active, isDefault: scope.isDefault, topic: cfg?.topic ?? null }}
            docs={docs.length} agentsOn={SCOPE_AGENT_KEYS.filter((k) => agents.get(k)?.enabled ?? true).length} agentsTotal={SCOPE_AGENT_KEYS.length} items={0} />
        </div>
      </div>

      <section className="detail-block" id="scope">
        <h2>{t('Scope')}</h2>
        <ScopeForm scopeId={scope.id} name={scope.name} instructions={scope.instructions ?? ''} />
      </section>

      <section className="detail-block" id="context">
        <h2>{t('Scope context')}</h2>
        {DOC_KINDS.map((k) => (
          <DocumentGroup key={k.kind} scopeId={scope.id} kind={k.kind} label={k.label} hint={k.hint} docs={docs.filter((d) => d.kind === k.kind)} />
        ))}
        <p className="field-hint">{t('PDF, Word, PowerPoint, Excel or text · up to 50 MB · private')}</p>
      </section>

      <section className="detail-block" id="agents">
        <h2>{t('Agents')}</h2>
        <div className="agent-grid">
          {AGENTS.filter((a) => SCOPE_AGENT_KEYS.includes(a.key)).map((a) => {
            const s = agents.get(a.key);
            const locked = a.key === 'news_report' && allowance.block === 'plan';
            if (a.key === 'search') {
              return (
                <AgentCard key={a.key} scopeId={scope.id} agent={a} enabled={s?.enabled ?? true} instructions={scope.searchScope}
                  config={cfg ? JSON.stringify(cfg, null, 2) : defaults.get('search')?.default_prompt ?? null} custom={!!cfg}
                  status={scope.searchStatus} error={scope.searchError} />
              );
            }
            return (
              <AgentCard key={a.key} scopeId={scope.id} agent={a} enabled={locked ? false : (s?.enabled ?? true)} instructions={s?.instructions ?? null}
                config={s?.prompt_override || defaults.get(a.key)?.default_prompt || null} custom={!!s?.prompt_override}
                status={s?.status ?? null} error={s?.error ?? null} locked={locked} />
            );
          })}
        </div>
      </section>

      <FollowingSection scopeId={scope.id} sources={sources} followed={followed} countries={countries} />

      {!scope.isDefault && (
        <section className="detail-block danger-zone">
          <h2>{t('Delete scope')}</h2>
          <DeleteScopeForm scopeId={scope.id} name={scope.name} />
        </section>
      )}
    </div>
  );
}
