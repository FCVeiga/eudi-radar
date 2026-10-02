'use client';

import { useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  FormState, createCompanyUpload, deleteCompanyDocument, registerCompanyDocument, saveCompany, saveSearchScope,
} from '@/app/settings/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
}
const Msg = ({ state }: { state: FormState }) => state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>;

export function CompanyForm({ name, context }: { name: string; context: string }) {
  const [state, action] = useFormState<FormState, FormData>(saveCompany, null);
  return (
    <form action={action} className="settings-form">
      <label className="field">
        <span>Company name</span>
        <input name="name" defaultValue={name} placeholder="e.g. WalliD" maxLength={120} required />
      </label>
      <label className="field">
        <span>Company context <em>— what the agents should know about you</em></span>
        <textarea name="context" defaultValue={context} rows={9} maxLength={30000}
          placeholder={'What you sell and to whom; products and the standards they implement; certifications (ISO 27001…); company size, turnover and locations; partners; the kind of contracts you bid for and the ones you don’t.'} />
      </label>
      <p className="field-hint">Every agent that writes about your company reads this: the Tender Evaluation Agent, the News Report Agent and the Feed Writer Agent.</p>
      <Msg state={state} />
      <div className="settings-actions"><Submit label="Save company" busy="Saving…" /></div>
    </form>
  );
}

type Doc = { id: string; name: string; size_bytes: number | null; chars: number | null; uploaded_at: string };
const kb = (n: number | null) => (!n ? '' : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** One kind of company material: its files, an upload button, delete. */
export function DocumentGroup({ kind, label, hint, docs }: { kind: string; label: string; hint: string; docs: Doc[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(files: FileList) {
    setError(null);
    for (const [i, file] of Array.from(files).entries()) {
      setStatus(`Uploading ${file.name}${files.length > 1 ? ` (${i + 1}/${files.length})` : ''}…`);
      const target = await createCompanyUpload(kind, file.name, file.size);
      if ('error' in target) { setError(`${file.name}: ${target.error}`); continue; }
      // Straight to storage, so large decks don't pass through the web server.
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', file);
      const res = await fetch(target.url!, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
      if (!res.ok) { setError(`${file.name}: upload failed (${res.status})`); continue; }
      setStatus(`Reading ${file.name}…`);
      const done = await registerCompanyDocument(kind, target.path!, file.name, file.size);
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

export function SearchScopeForm({ scope }: { scope: string }) {
  const [state, action] = useFormState<FormState, FormData>(saveSearchScope, null);
  return (
    <form action={action} className="settings-form">
      <label className="field">
        <span>What should the radar look for?</span>
        <textarea name="scope" defaultValue={scope} rows={8} maxLength={8000}
          placeholder={'e.g. Public tenders, grants and market consultations for digital identity wallets in Europe: EUDI Wallet development and certification, PID and (Q)EAA issuers, relying-party integration, mobile driving licences, trust services. Buyers: national governments, digital agencies, banks and telcos in the EU, EEA and UK. Not interested in: crypto wallets, payment wallets, generic IAM or cybersecurity tenders.'} />
      </label>
      <p className="field-hint">The Config Agent turns this into the Search Agent’s phrases and queries (in every country’s languages) and the Triage Agent’s relevance rules, which decide what reaches the feed, News and Tenders.</p>
      <Msg state={state} />
      <div className="settings-actions"><Submit label="Save & apply" busy="The Config Agent is working — about a minute…" /></div>
    </form>
  );
}
