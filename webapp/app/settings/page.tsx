import { readFile } from 'fs/promises';
import path from 'path';
import { AGENTS } from '@/lib/agents';
import { DEFAULT_COMPANY, DOC_KINDS, getSettings } from '@/lib/settings';
import AgentCard from '@/components/settings/AgentCard';
import { CompanyForm, DocumentGroup, SearchScopeForm } from '@/components/settings/SettingsForms';

// The Config Agent runs inside this page's server actions: give it time.
export const maxDuration = 300;

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function SettingsPage() {
  const { company, search, agents, docs } = await getSettings();
  const cfg = search.config;
  // Until the company is saved, show what the agents use today: the built-in brief.
  const builtIn = !company.name && !company.context;
  const brief = builtIn ? await readFile(path.join(process.cwd(), 'agents', 'company_brief.md'), 'utf8').catch(() => '') : '';

  return (
    <div className="settings">
      <h1 className="opps-h1">Settings</h1>

      <section className="detail-block" id="company">
        <h2>Company</h2>
        {builtIn && <p className="settings-intro">Prefilled with the built-in brief the agents use today — edit it and save to make it yours.</p>}
        <CompanyForm name={company.name || DEFAULT_COMPANY} context={company.context || brief} />
      </section>

      <section className="detail-block" id="material">
        <h2>Company material</h2>
        <p className="settings-intro">
          What the Tender Evaluation Agent checks each tender against: it reads the text of every file here, alongside
          the company context. The more specific the material — clients, contract values, dates, team roles — the
          fewer requirements come back “Unknown”.
        </p>
        {DOC_KINDS.map((k) => (
          <DocumentGroup key={k.kind} kind={k.kind} label={k.label} hint={k.hint} docs={docs.filter((d) => d.kind === k.kind)} />
        ))}
        <p className="field-hint">PDF, Word, PowerPoint, Excel or text, up to 50 MB each. Files are stored privately; only the agents read them.</p>
      </section>

      <section className="detail-block" id="agents">
        <h2>Agents</h2>
        <p className="settings-intro">
          Switch an agent off to stop its work. Tell it what to change in plain language and the Config Agent rewrites
          its configuration — or open the configuration and edit it yourself. Whatever is saved is what the agent runs on.
        </p>
        <div className="agent-grid">
          {AGENTS.map((a) => {
            const s = agents.get(a.key);
            if (a.key === 'search') {
              // The Search Agent's instructions are the search scope; its config, the parsed search.
              return (
                <AgentCard key={a.key} agent={a} enabled={s?.enabled ?? true} instructions={search.scope || null}
                  config={cfg ? JSON.stringify(cfg, null, 2) : s?.default_prompt ?? null} custom={!!cfg}
                  status={search.status} error={search.error}
                  summary={cfg
                    ? `${cfg.topic || 'Custom scope'} · ${cfg.ted_phrases?.length ?? 0} TED phrases, ${cfg.web_queries?.length ?? 0} web and ${cfg.news_queries?.length ?? 0} news queries${search.parsed_at ? ` · since ${fmt(search.parsed_at)}` : ''}`
                    : 'Built-in scope: EUDI Wallet & digital identity'} />
              );
            }
            return (
              <AgentCard key={a.key} agent={a} enabled={s?.enabled ?? true} instructions={s?.instructions ?? null}
                config={a.fineTune ? s?.prompt_override || s?.default_prompt || null : null} custom={!!s?.prompt_override}
                status={s?.status ?? null} error={s?.error ?? null} />
            );
          })}
        </div>
        <p className="field-hint">The Config Agent itself is internal: it only runs when you apply a search scope or plain-language instructions here.</p>
      </section>
    </div>
  );
}
