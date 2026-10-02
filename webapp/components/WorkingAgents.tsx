import Link from 'next/link';
import { AGENTS } from '@/lib/agents';
import { disabledAgents } from '@/lib/settings';
import AgentAvatar from './AgentAvatar';

/** Sidebar: the agents switched on in Settings, each with its face and a green light. */
export default async function WorkingAgents() {
  let off = new Set<string>();
  try { off = await disabledAgents(); } catch { /* settings tables missing: all on */ }
  const active = AGENTS.filter((a) => !off.has(a.key));
  return (
    <div className="side-panel working-agents">
      <div className="side-head">
        <h3>Working Agents</h3>
        <span className="side-count" title={`${active.length} switched on of ${AGENTS.length}`}>{active.length}/{AGENTS.length}</span>
      </div>
      <ul>
        {active.map((a) => (
          <li key={a.key}>
            <Link href="/settings#agents" title={a.role}>
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
