'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import AgentAvatar from '@/components/AgentAvatar';
import {
  FormState, resetAgentConfig, saveAgentConfig, saveAgentTuning, saveSearchScope, setAgentEnabled,
} from '@/app/settings/actions';
import type { AgentDef } from '@/lib/agents';

function Submit({ label, busy, primary }: { label: string; busy: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={`btn ${primary ? 'primary' : ''}`} disabled={pending}>{pending ? busy : label}</button>;
}

/**
 * One agent on Settings: face, name, on/off, plain-language instructions
 * (for the Search Agent: the search scope), and its configuration — shown
 * and editable under "Open config"; what is saved there is what it runs on.
 */
export default function AgentCard({ agent, enabled, instructions, config, custom, status, error }: {
  agent: AgentDef; enabled: boolean; instructions: string | null; config: string | null;
  custom: boolean; status: string | null; error: string | null;
}) {
  const router = useRouter();
  const search = agent.key === 'search';
  const editable = agent.fineTune || search;
  const [on, setOn] = useState(enabled);
  const [, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const [tuneState, tune] = useFormState<FormState, FormData>(search ? saveSearchScope : saveAgentTuning, null);
  const [editState, save] = useFormState<FormState, FormData>(saveAgentConfig, null);
  const [draft, setDraft] = useState(config ?? '');
  useEffect(() => setDraft(config ?? ''), [config]);  // a fresh config after a save or a rewrite

  return (
    <div className={`agent-card ${on ? '' : 'off'}`}>
      <div className="agent-card-head">
        <AgentAvatar agent={agent.key} size={42} off={!on} />
        <div className="agent-card-id">
          <h3>{agent.name}</h3>
          <span className="agent-runs">{agent.runs === 'pipeline' ? 'Daily pipeline' : agent.runs === 'on click' ? 'On click' : 'When a story is opened'}{custom ? ' · customised' : ''}</span>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label={`${agent.name} ${on ? 'on' : 'off'}`}
          className={`switch ${on ? 'on' : ''}`}
          onClick={() => { const next = !on; setOn(next); start(() => setAgentEnabled(agent.key, next)); }}>
          <span />
        </button>
      </div>
      <p className="agent-role">{agent.role}</p>

      {config && (
        <div className="agent-card-actions">
          <button type="button" className="btn" onClick={() => dialog.current?.showModal()}>Open config</button>
        </div>
      )}

      {editable && (
        <form action={tune} className="agent-tune">
          <input type="hidden" name="agent" value={agent.key} />
          <label className="field">
            <span>Fine-tuning <em>— in plain language</em></span>
            <textarea name={search ? 'scope' : 'instructions'} rows={3} defaultValue={instructions ?? ''} maxLength={search ? 8000 : 6000}
              placeholder={`e.g. ${EXAMPLES[agent.key] ?? 'Be more concise.'}`} />
          </label>
          {tuneState ? <p className={`form-msg ${tuneState.ok ? 'ok' : 'err'}`}>{tuneState.message}</p>
            : status === 'error' && error ? <p className="form-msg err">Last attempt not applied: {error}.</p> : null}
          <div className="settings-actions"><Submit label="Apply" busy="The Config Agent is working…" /></div>
        </form>
      )}

      <dialog ref={dialog} className="modal modal-wide" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <form action={save} className="modal-body">
          <input type="hidden" name="agent" value={agent.key} />
          <div className="modal-head">
            <h2>{agent.name} — {custom ? 'customised configuration' : 'default configuration'}</h2>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
          </div>
          <p className="field-hint">
            {search
              ? 'JSON: the TED phrases, web and news queries, site-search terms and the Triage Agent’s relevance rules. Fine-tuning describes the search scope and replaces it.'
              : agent.key === 'tender_documents'
                ? 'JSON: how files are sorted by name (type_patterns, first match wins), which new files post an update (alert_on_new), which are skipped, and whether only open tenders are covered.'
                : editable
                ? <>The agent’s instructions{agent.prompt ? <> (<span className="mono">{agent.prompt}</span>)</> : null}. Edit freely, but keep the <span className="mono">## Output</span> section and the placeholders in braces — the platform depends on them.</>
                : 'This agent doesn’t use AI instructions; nothing to configure.'}
          </p>
          {editable
            ? <textarea name="config" className="config-edit" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
            : <pre className="config-view">{config}</pre>}
          {editState && <p className={`form-msg ${editState.ok ? 'ok' : 'err'}`}>{editState.message}</p>}
          {editable && (
            <div className="modal-actions">
              {custom && (
                <button type="button" className="btn" onClick={() => {
                  if (confirm(`Reset ${agent.name} to its default configuration${search ? '' : ' and clear its fine-tuning'}?`)) {
                    start(async () => { await resetAgentConfig(agent.key); router.refresh(); });
                  }
                }}>Reset to default</button>
              )}
              <button type="button" className="btn" onClick={() => setDraft(config ?? '')}>Discard changes</button>
              <Submit label="Save" busy="Saving…" primary />
            </div>
          )}
        </form>
      </dialog>
    </div>
  );
}

const EXAMPLES: Record<string, string> = {
  search: 'Tenders and grants for digital identity wallets in the EU and UK: wallet development, PID/(Q)EAA issuers, mDL. Not crypto or payment wallets.',
  tender_documents: 'Treat files named “Leistungsverzeichnis” as technical specifications. Post an update when a new contract draft appears.',
  triage: 'Score anything about mobile driving licences at least 80. Treat banking KYC tenders as relevant.',
  verification: 'Treat a call as open only if the page shows a deadline.',
  tender_analysis: 'Also list the languages the bid must be written in, and every insurance requirement with its amount.',
  tender_evaluation: 'Be strict: no MATCH without a named reference in our material. Always suggest a partner for hardware.',
  news_report: 'Keep summaries under 300 words. Always suggest a LinkedIn post angle.',
  feed_writer: 'Lead every tender post with the value and the deadline.',
  translator: 'Keep German agency names untranslated, without the English in parentheses.',
};
