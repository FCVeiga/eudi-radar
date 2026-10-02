'use client';

import { useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import AgentAvatar from '@/components/AgentAvatar';
import { FormState, saveAgentTuning, setAgentEnabled } from '@/app/settings/actions';
import type { AgentDef } from '@/lib/agents';

function Apply() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn" disabled={pending}>{pending ? 'The Config Agent is rewriting…' : 'Apply'}</button>;
}

/** One agent on Settings: face, name, on/off, its config file, plain-language fine-tuning. */
export default function AgentCard({ agent, enabled, instructions, config, tuned, status, error }: {
  agent: AgentDef; enabled: boolean; instructions: string | null; config: string | null;
  tuned: boolean; status: string | null; error: string | null;
}) {
  const [on, setOn] = useState(enabled);
  const [, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action] = useFormState<FormState, FormData>(saveAgentTuning, null);

  return (
    <div className={`agent-card ${on ? '' : 'off'}`}>
      <div className="agent-card-head">
        <AgentAvatar agent={agent.key} size={42} off={!on} />
        <div className="agent-card-id">
          <h3>{agent.name}</h3>
          <span className="agent-runs">{agent.runs === 'pipeline' ? 'Daily pipeline' : agent.runs === 'on click' ? 'On click' : 'When a story is opened'}{tuned ? ' · fine-tuned' : ''}</span>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label={`${agent.name} ${on ? 'on' : 'off'}`}
          className={`switch ${on ? 'on' : ''}`}
          onClick={() => { const next = !on; setOn(next); start(() => setAgentEnabled(agent.key, next)); }}>
          <span />
        </button>
      </div>
      <p className="agent-role">{agent.role}</p>

      <div className="agent-card-actions">
        <button type="button" className="btn" onClick={() => dialog.current?.showModal()} disabled={!config && !agent.prompt}>
          Open config
        </button>
      </div>

      {agent.fineTune && (
        <form action={action} className="agent-tune">
          <input type="hidden" name="agent" value={agent.key} />
          <label className="field">
            <span>Fine-tuning <em>— in plain language</em></span>
            <textarea name="instructions" rows={3} defaultValue={instructions ?? ''} maxLength={6000}
              placeholder={`e.g. ${EXAMPLES[agent.key] ?? 'Be more concise.'}`} />
          </label>
          {state ? <p className={`form-msg ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>
            : status === 'error' && error ? <p className="form-msg err">Last attempt not applied: {error}.</p> : null}
          <div className="settings-actions"><Apply /></div>
        </form>
      )}

      <dialog ref={dialog} className="modal modal-wide" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="modal-body">
          <div className="modal-head">
            <h2>{agent.name} — {tuned ? 'fine-tuned configuration' : 'default configuration'}</h2>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
          </div>
          {agent.prompt && <p className="field-hint mono">{tuned ? `${agent.prompt}, rewritten by the Config Agent` : agent.prompt}</p>}
          <pre className="config-view">{config ?? 'This configuration is synced from the repository on the next pipeline run.'}</pre>
        </div>
      </dialog>
    </div>
  );
}

const EXAMPLES: Record<string, string> = {
  triage: 'Score anything about mobile driving licences at least 80. Treat banking KYC tenders as relevant.',
  verification: 'Treat a call as open only if the page shows a deadline.',
  tender_analysis: 'Also list the languages the bid must be written in, and every insurance requirement with its amount.',
  tender_evaluation: 'Be strict: no MATCH without a named reference in our material. Always suggest a partner for hardware.',
  news_report: 'Keep summaries under 300 words. Always suggest a LinkedIn post angle.',
  feed_writer: 'Lead every tender post with the value and the deadline.',
  translator: 'Keep German agency names untranslated, without the English in parentheses.',
};
