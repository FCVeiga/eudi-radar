'use client';

import { useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  FormState, createCompanyUpload, deleteCompanyDocument, deleteScope, registerCompanyDocument, saveScope,
} from '@/app/workspaces/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
}
const Msg = ({ state }: { state: FormState }) => state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>;

export function ScopeForm({ scopeId, name, instructions }: { scopeId: string; name: string; instructions: string }) {
  const [state, action] = useFormState<FormState, FormData>(saveScope, null);
  return (
    <form action={action} className="settings-form">
      <input type="hidden" name="scope" value={scopeId} />
      <label className="field">
        <span>Scope name</span>
        <input name="name" defaultValue={name} placeholder="e.g. EUDI Wallet — public sector" maxLength={120} required />
      </label>
      <label className="field">
        <span>Scope instructions</span>
        <textarea name="instructions" defaultValue={instructions} rows={9} maxLength={30000}
          placeholder={'Who the scope is for (a company, a department, a project); what you sell and to whom; products and the standards they implement; certifications; size, turnover and locations; partners; the contracts you go for and the ones you don’t.'} />
      </label>
      <Msg state={state} />
      <div className="settings-actions"><Submit label="Save scope" busy="Saving…" /></div>
    </form>
  );
}

export function DeleteScopeForm({ scopeId, name }: { scopeId: string; name: string }) {
  const [state, action] = useFormState<FormState, FormData>(deleteScope, null);
  return (
    <form action={action} className="settings-form">
      <input type="hidden" name="scope" value={scopeId} />
      <p className="field-hint">Deletes the scope, its documents and evaluations.</p>
      <label className="field"><span>Type <strong>{name}</strong> to confirm</span><input name="confirm" autoComplete="off" required /></label>
      <Msg state={state} />
      <div className="settings-actions"><button type="submit" className="btn danger">Delete scope</button></div>
    </form>
  );
}

type Doc = { id: string; name: string; size_bytes: number | null; chars: number | null; uploaded_at: string };
const kb = (n: number | null) => (!n ? '' : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** One kind of company material: its files, an upload button, delete. */
export function DocumentGroup({ scopeId, kind, label, hint, docs }: { scopeId: string; kind: string; label: string; hint: string; docs: Doc[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(files: FileList) {
    setError(null);
    for (const [i, file] of Array.from(files).entries()) {
      setStatus(`Uploading ${file.name}${files.length > 1 ? ` (${i + 1}/${files.length})` : ''}…`);
      const target = await createCompanyUpload(scopeId, kind, file.name, file.size);
      if ('error' in target) { setError(`${file.name}: ${target.error}`); continue; }
      // Straight to storage, so large decks don't pass through the web server.
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', file);
      const res = await fetch(target.url!, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
      if (!res.ok) { setError(`${file.name}: upload failed (${res.status})`); continue; }
      setStatus(`Reading ${file.name}…`);
      const done = await registerCompanyDocument(scopeId, kind, target.path!, file.name, file.size);
      if ('error' in done && done.error) setError(`${file.name}: ${done.error}`);
    }
    setStatus(null);
    if (input.current) input.current.value = '';
    startTransition(() => router.refresh());
  }

  return (
    <div className="doc-kind">
      <div className="doc-kind-head">
        <div><h3>{label} <span className="uc-count">{docs.length}</span></h3><p>{hint}</p></div>
        <button type="button" className="btn" onClick={() => input.current?.click()} disabled={!!status}>Upload</button>
        <input ref={input} type="file" multiple hidden accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv"
          onChange={(e) => e.target.files?.length && upload(e.target.files)} />
      </div>
      {docs.length > 0 && (
        <ul className="doc-files">
          {docs.map((d) => (
            <li key={d.id}>
              <span className="doc-file-name">{d.name}</span>
              <span className="doc-file-meta">{kb(d.size_bytes)}{d.chars ? ` · ${d.chars.toLocaleString()} characters read` : ' · no text found (scanned?)'}</span>
              <button type="button" className="doc-file-del" aria-label={`Remove ${d.name}`}
                onClick={() => { if (confirm(`Remove ${d.name}?`)) deleteCompanyDocument(d.id).then(() => router.refresh()); }}>×</button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="report-progress"><span className="dots" /> {status}</p>}
      {error && <p className="form-msg err">{error}</p>}
    </div>
  );
}
