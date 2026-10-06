import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AGENTS } from '@/lib/agents';
import { getContext } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PLATFORM_AGENT_KEYS, SCOPE_AGENT_KEYS, getWorkspaceScopes } from '@/lib/scopes';
import { getAgentDefaults } from '@/lib/settings';
import AgentCard from '@/components/settings/AgentCard';
import ScopeCard from '@/components/settings/ScopeCard';
import { createScope } from './actions';

// The Config Agent runs inside the workspace agents' server actions: give it time.
export const maxDuration = 300;

/** Workspace: the current workspace's scopes (each with its instructions, context, search and agents) and the workspace agents. */
export default async function WorkspacePage() {
  const ctx = await getContext();
  if (!ctx) redirect('/login?next=/workspace');
  const db = getSupabaseServerClient();
  const scopes = await getWorkspaceScopes(ctx.workspace.id);
  const ids = scopes.map((s) => s.id);
  const [agentDefaults, { data: docs }, { data: agentRows }, { data: items }, { data: defaultScope }] = await Promise.all([
    getAgentDefaults(),
    ids.length ? db.from('company_documents').select('scope_id').in('scope_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('scope_agent_settings').select('scope_id, agent_key, enabled').in('scope_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('scope_items').select('scope_id').in('scope_id', ids).limit(50000) : Promise.resolve({ data: [] as any[] }),
    db.from('scopes').select('name').eq('is_default', true).maybeSingle(),
  ]);
  const count = (rows: any[] | null, id: string) => (rows || []).filter((r) => r.scope_id === id).length;
  const plan = ctx.account.plan;
  const isPlatform = ctx.account.kind === 'platform';
  const limit = isPlatform ? Infinity : plan.scopes;
  const canAdd = ctx.canCustomize && scopes.length < limit;

  return (
    <div className="settings">
      <div className="community-head">
        <div>
          <h1 className="opps-h1">Workspace</h1>
          <p className="ws-sub">{ctx.workspace.name} · {ctx.account.kind === 'personal' ? 'Personal account' : ctx.account.name} · {isPlatform ? 'Platform' : plan.name} plan</p>
        </div>
        {canAdd && <form action={createScope}><button type="submit" className="btn primary">+ New scope</button></form>}
      </div>

      {!ctx.isAdmin && <p className="callout">You’re a member of this workspace: you see its agents’ results. Its admins configure the scopes.</p>}
      {ctx.isAdmin && !plan.customize && (
        <p className="callout">
          On the Free plan you follow the default scope — {defaultScope?.name ?? 'EUDI Wallet & digital identity'} — updated once a day.
          <Link href="/settings#billing"> Upgrade</Link> to create your own scopes with your instructions, context and agents.
        </p>
      )}

      <section className="detail-block" id="scopes">
        <h2>Scopes <span className="uc-count">{scopes.length}{Number.isFinite(limit) && plan.customize ? `/${limit}` : ''}</span></h2>
        <p className="settings-intro">
          A scope is one configuration of the radar — for a company, a department or a project: its instructions, context
          documents, search and agents. Home, Community, Tenders, News and History show the results of this workspace’s active
          scopes together. Agents update them {isPlatform ? 'once' : plan.runsPerDay === 1 ? 'once' : `${plan.runsPerDay} times`} a day.
        </p>
        {scopes.length === 0 ? (
          <div className="profile-empty">
            <p className="profile-empty-title">No scopes in this workspace</p>
            <p className="muted">Until there is one, it shows the default scope ({defaultScope?.name ?? 'EUDI Wallet & digital identity'}).</p>
            {canAdd ? <form action={createScope}><button type="submit" className="btn primary profile-empty-cta">Create the first scope</button></form>
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
          <p className="field-hint">You’ve reached the {plan.name} plan’s {limit} {limit === 1 ? 'scope' : 'scopes'}. <Link href="/settings#billing">Upgrade</Link> for more.</p>
        )}
      </section>

      <section className="detail-block" id="workspace-agents">
        <h2>Workspace agents</h2>
        <p className="settings-intro">
          These agents work on the data every workspace shares — a tender’s documents and requirements, the feed’s posts,
          translation into the platform language. The platform’s admins configure them{ctx.isPlatformAdmin ? ' (you’re one of them)' : ''}.
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
