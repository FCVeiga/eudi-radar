import { redirect } from 'next/navigation';
import { AGENTS } from '@/lib/agents';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import { MAX_ACTIVE_SCOPES, PLATFORM_AGENT_KEYS, SCOPE_AGENT_KEYS, getMyScopes } from '@/lib/scopes';
import { getAgentDefaults } from '@/lib/settings';
import AgentCard from '@/components/settings/AgentCard';
import ScopeCard from '@/components/settings/ScopeCard';
import { createScope } from './actions';

// The Config Agent runs inside the platform agents' server actions: give it time.
export const maxDuration = 300;

/** Settings: your scopes (each with its own instructions, context, search and agents) and the platform agents. */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings');
  const db = getSupabaseServerClient();
  const scopes = await getMyScopes(user.id);
  const ids = scopes.map((s) => s.id);
  const [agentDefaults, { data: docs }, { data: agentRows }, { data: items }] = await Promise.all([
    getAgentDefaults(),
    ids.length ? db.from('company_documents').select('scope_id').in('scope_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('scope_agent_settings').select('scope_id, agent_key, enabled').in('scope_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from('scope_items').select('scope_id').in('scope_id', ids).limit(50000) : Promise.resolve({ data: [] as any[] }),
  ]);
  const count = (rows: any[] | null, id: string) => (rows || []).filter((r) => r.scope_id === id).length;
  const activeCount = scopes.filter((s) => s.active).length;

  return (
    <div className="settings">
      <div className="community-head">
        <h1 className="opps-h1">Settings</h1>
        <form action={createScope}><button type="submit" className="btn primary">+ New scope</button></form>
      </div>

      <section className="detail-block" id="scopes">
        <h2>Scopes <span className="uc-count">{scopes.length}</span></h2>
        <p className="settings-intro">
          A scope is one configuration of the radar — for a company, a department or a project: its instructions, context
          documents, search and agents. Switch on the scopes you’re working on: Home, Community, Tenders, News and History
          show the results of your active scopes together. Up to {MAX_ACTIVE_SCOPES} can be active at once ({activeCount} now).
        </p>
        {scopes.length === 0 ? (
          <div className="profile-empty">
            <p className="profile-empty-title">No scopes yet</p>
            <p className="muted">Until you create one, you see the platform’s default scope (EUDI Wallet &amp; digital identity).</p>
            <form action={createScope}><button type="submit" className="btn primary profile-empty-cta">Create your first scope</button></form>
          </div>
        ) : (
          <div className="scope-grid">
            {scopes.map((s) => {
              const on = SCOPE_AGENT_KEYS.filter((k) => (agentRows || []).find((r: any) => r.scope_id === s.id && r.agent_key === k)?.enabled ?? true).length;
              return (
                <ScopeCard key={s.id} scope={{ id: s.id, name: s.name, instructions: s.instructions, active: s.active, isDefault: s.isDefault, topic: s.searchConfig?.topic ?? null }}
                  docs={count(docs, s.id)} agentsOn={on} agentsTotal={SCOPE_AGENT_KEYS.length} items={count(items, s.id)} />
              );
            })}
          </div>
        )}
      </section>

      <section className="detail-block" id="platform-agents">
        <h2>Platform agents</h2>
        <p className="settings-intro">
          These agents work on the shared data every scope draws on — a tender’s documents and requirements, the feed’s posts,
          translation into the platform language — so they’re configured once, not per scope.
        </p>
        <div className="agent-grid">
          {AGENTS.filter((a) => PLATFORM_AGENT_KEYS.includes(a.key)).map((a) => {
            const s = agentDefaults.get(a.key);
            return (
              <AgentCard key={a.key} agent={a} enabled={s?.enabled ?? true} instructions={s?.instructions ?? null}
                config={a.fineTune ? s?.prompt_override || s?.default_prompt || null : null} custom={!!s?.prompt_override}
                status={s?.status ?? null} error={s?.error ?? null} />
            );
          })}
        </div>
      </section>
    </div>
  );
}
