import Link from 'next/link';
import { AGENTS } from '@/lib/agents';
import { workingAgentKeys } from '@/lib/settings';
import AgentAvatar from './AgentAvatar';
import { getT } from '@/lib/i18n/server';

/** Sidebar: the agents at work for your active scopes (and the platform's), each with its face and a green light. */
export default async function WorkingAgents() {
  const t = await getT();
  let on: Set<string> | null = null;
  try { on = await workingAgentKeys(); } catch { /* settings tables missing: all on */ }
  const active = AGENTS.filter((a) => !on || on.has(a.key));
  return (
    <div className="side-panel working-agents">
      <div className="side-head">
        <h3>{t('Working Agents')}</h3>
        <span className="side-count" title={t('{n} switched on of {total}', { n: active.length, total: AGENTS.length })}>{active.length}/{AGENTS.length}</span>
      </div>
      <ul>
        {active.map((a) => (
          <li key={a.key}>
            <Link href="/workspaces" title={t(a.role)}>
              <AgentAvatar agent={a.key} size={22} />
              <span className="wa-name">{t(a.name)}</span>
              <span className="live-dot" aria-label={t('active')} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
