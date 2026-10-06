import Link from 'next/link';
import { AGENTS } from '@/lib/agents';
import { workingAgentKeys } from '@/lib/settings';
import AgentAvatar from './AgentAvatar';

/** Sidebar: the agents at work for your active scopes (and the platform's), each with its face and a green light. */
export default async function WorkingAgents() {
  let on: Set<string> | null = null;
  try { on = await workingAgentKeys(); } catch { /* settings tables missing: all on */ }
  const active = AGENTS.filter((a) => !on || on.has(a.key));
  return (
    <div className="side-panel working-agents">
      <div className="side-head">
        <h3>Working Agents</h3>
        <span className="side-count" title={`${active.length} switched on of ${AGENTS.length}`}>{active.length}/{AGENTS.length}</span>
      </div>
      <ul>
        {active.map((a) => (
          <li key={a.key}>
            <Link href="/workspace" title={a.role}>
              <AgentAvatar agent={a.key} size={22} />
              <span className="wa-name">{a.name}</span>
              <span className="live-dot" aria-label="active" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
