'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { saveSource, SaveSourceState } from '@/app/actions';
import {
  FREQUENCIES, METHODS, Method, NOT_CONNECTABLE, SOURCE_GROUPS, SOURCE_TYPES, Source, typeMeta,
} from '@/lib/sourceMeta';
import SourceIcon from './SourceIcon';

export type Country = { code: string; name: string };

/** Health of a source as shown by its dot: ok, failing, paused or not monitored. */
export function health(s: Source) {
  if (!s.enabled) return { cls: 'paused', note: 'Paused' };
  if (s.method === 'off') return { cls: 'off', note: NOT_CONNECTABLE.includes(s.source_type) ? 'Not connected — needs API access' : 'Listed, not monitored' };
  if (s.last_error) return { cls: 'err', note: `Last check failed: ${s.last_error}` };
  if (!s.last_checked) return { cls: 'pending', note: `${METHODS[s.method].label} · first check on the next run` };
  return { cls: 'ok', note: `${METHODS[s.method].label} · checked ${new Date(s.last_checked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` };
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never';

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Follow source'}</button>;
}

export function SourceForm({ source, countries, onDone }: { source: Source | null; countries: Country[]; onDone: () => void }) {
  const router = useRouter();
  const [state, action] = useFormState<SaveSourceState, FormData>(saveSource, null);
  const [type, setType] = useState<string>(source?.source_type ?? 'PROCUREMENT_PORTAL');
  const [method, setMethod] = useState<string>(source ? source.method : 'auto');
  const social = type.startsWith('SOCIAL_');
  const blocked = NOT_CONNECTABLE.includes(type);
  const isTed = source?.method === 'ted';

  useEffect(() => {
    if (!state?.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [state, router, onDone]);

  return (
    <form action={action} className="modal-body">
      <div className="modal-head">
        <h2>{source ? 'Source settings' : 'Follow a source'}</h2>
        <button type="button" className="modal-close" aria-label="Close" onClick={onDone}>×</button>
      </div>
      {source && <input type="hidden" name="source_id" value={source.source_id} />}

      <div className="field-row">
        <label className="field">
          <span>Type</span>
          <select name="source_type" value={type} onChange={(e) => setType(e.target.value)}>
            {SOURCE_GROUPS.map((g) => (
              <optgroup key={g.key} label={g.label}>
                {SOURCE_TYPES.filter((t) => (g.types as readonly string[]).includes(t.value)).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Country <em>(optional)</em></span>
          <select name="country" defaultValue={source?.country ?? ''}>
            <option value="">International / EU</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span>{social ? (type === 'SOCIAL_REDDIT' ? 'Subreddit or user' : 'Handle or profile URL') : 'Website or feed URL'}</span>
        <input name="url" required defaultValue={source?.handle || source?.url || ''} autoComplete="off"
               placeholder={type === 'SOCIAL_REDDIT' ? 'r/digitalidentity' : type === 'SOCIAL_TWITTER' ? '@handle' : 'https://…'} />
      </label>
      <label className="field">
        <span>Name <em>(optional)</em></span>
        <input name="name" defaultValue={source?.name ?? ''} placeholder="e.g. Portugal — Base.gov" autoComplete="off" />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Monitoring</span>
          <select name="method" value={isTed ? 'ted' : blocked ? 'off' : method} onChange={(e) => setMethod(e.target.value)} disabled={isTed || blocked}>
            {!source && <option value="auto">Automatic — feed if found, else site search</option>}
            {isTed && <option value="ted">{METHODS.ted.label}</option>}
            {(['rss', 'site_search', 'off'] as Method[]).map((m) => <option key={m} value={m}>{METHODS[m].label}</option>)}
          </select>
          {(isTed || blocked) && <input type="hidden" name="method" value={isTed ? 'ted' : 'off'} />}
        </label>
        <label className="field">
          <span>Check every</span>
          <select name="check_every_days" defaultValue={String(source?.check_every_days ?? 7)} disabled={method === 'rss' || isTed || method === 'off'}>
            {FREQUENCIES.map((d) => <option key={d} value={d}>{d === 1 ? 'day' : `${d} days`}</option>)}
          </select>
          {(method === 'rss' || isTed || method === 'off') && <input type="hidden" name="check_every_days" value={String(source?.check_every_days ?? 7)} />}
        </label>
      </div>
      <p className="field-hint">
        {blocked ? 'Monitored once API access is set up.'
          : method === 'auto' ? 'Uses the site’s feed if it has one.'
            : METHODS[(isTed ? 'ted' : method) as Method].hint}
        
      </p>

      <label className="toggle">
        <input type="checkbox" name="enabled" defaultChecked={source?.enabled ?? true} />
        <span>Monitoring on</span>
      </label>

      {source && (
        <dl className="source-stats">
          <div><dt>Last check</dt><dd>{fmt(source.last_checked)}</dd></div>
          <div><dt>Last result</dt><dd>{source.last_error ? <span className="err">{source.last_error}</span> : source.number_results_last_run != null ? `${source.number_results_last_run} items` : '—'}</dd></div>
          {source.feed_url && <div className="wide"><dt>Feed</dt><dd className="mono">{source.feed_url}</dd></div>}
        </dl>
      )}

      {state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <Submit editing={!!source} />
      </div>
    </form>
  );
}

export default function SourcesPanel({ sources, countries }: { sources: Source[]; countries: Country[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Source | null | undefined>(undefined); // undefined = closed, null = new
  const monitored = sources.filter((s) => s.enabled && s.method !== 'off').length;

  useEffect(() => {
    if (editing !== undefined) dialog.current?.showModal();
  }, [editing]);
  const close = () => { dialog.current?.close(); setEditing(undefined); };

  return (
    <div className="side-panel">
      <div className="side-head">
        <h3>Following</h3>
        <span className="side-count" title={`${monitored} monitored of ${sources.length}`}>{monitored}/{sources.length}</span>
      </div>
      <div className="source-groups">
        {SOURCE_GROUPS.map((g) => {
          const list = sources.filter((s) => (g.types as readonly string[]).includes(s.source_type));
          if (!list.length) return null;
          const failing = list.filter((s) => s.enabled && s.last_error).length;
          return (
            <details key={g.key} className="source-group">
              <summary>
                <span className="group-label">{g.label}</span>
                {failing > 0 && <span className="group-alert" title={`${failing} failing`}>{failing}</span>}
                <span className="group-count">{list.length}</span>
              </summary>
              <ul className="account-list">
                {list.map((s) => {
                  const h = health(s);
                  return (
                    <li key={s.source_id}>
                      <button type="button" className={`account ${h.cls}`} title={`${typeMeta(s.source_type).label} · ${h.note}`}
                              onClick={() => setEditing(s)}>
                        <SourceIcon type={s.source_type} size={22} />
                        <span className="account-name">{s.name.replace(/ — national procurement portal$/, '')}</span>
                        <span className={`account-state ${h.cls}`} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
      <button type="button" className="btn add-account" onClick={() => setEditing(null)}>
        <span aria-hidden="true">+</span> Add source
      </button>

      <dialog ref={dialog} className="modal" onClose={() => setEditing(undefined)}
              onClick={(e) => { if (e.target === dialog.current) close(); }}>
        {editing !== undefined && (
          <SourceForm key={editing?.source_id ?? 'new'} source={editing} countries={countries} onDone={close} />
        )}
      </dialog>
    </div>
  );
}
