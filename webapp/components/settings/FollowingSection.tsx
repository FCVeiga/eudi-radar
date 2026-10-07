'use client';

import { useEffect, useRef, useState } from 'react';
import { SOURCE_GROUPS, Source, typeMeta } from '@/lib/sourceMeta';
import SourceIcon from '@/components/SourceIcon';
import { Country, SourceForm, health } from '@/components/SourcesPanel';

const PAGE = 12;

/** Scope page → Following: the sources the radar tracks, filterable by group; a row opens its settings. */
export default function FollowingSection({ sources, countries }: { sources: Source[]; countries: Country[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Source | null | undefined>(undefined); // undefined = closed, null = new
  const [group, setGroup] = useState<string>('all');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  useEffect(() => { if (editing !== undefined) dialog.current?.showModal(); }, [editing]);
  const close = () => { dialog.current?.close(); setEditing(undefined); };

  const monitored = sources.filter((s) => s.enabled && s.method !== 'off').length;
  const groups = SOURCE_GROUPS.map((g) => ({ ...g, list: sources.filter((s) => (g.types as readonly string[]).includes(s.source_type)) })).filter((g) => g.list.length);
  const needle = q.trim().toLowerCase();
  const shown = (group === 'all' ? sources : groups.find((g) => g.key === group)?.list ?? [])
    .filter((s) => !needle || `${s.name} ${s.url ?? ''} ${s.handle ?? ''} ${s.country ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
  const country = (code: string | null) => (code ? countries.find((c) => c.code === code)?.name ?? code : 'International');

  return (
    <section className="detail-block" id="following">
      <div className="section-head">
        <h2>Following <span className="uc-count" title="Monitored of total">{monitored}/{sources.length}</span></h2>
        <button type="button" className="btn primary" onClick={() => setEditing(null)}>Add source</button>
      </div>

      <div className="follow-toolbar">
        <nav className="feed-sort follow-groups" aria-label="Source groups">
          <button type="button" className={`feed-sort-link ${group === 'all' ? 'active' : ''}`} onClick={() => { setGroup('all'); setAll(false); }}>
            All <span className="pill-count">{sources.length}</span>
          </button>
          {groups.map((g) => (
            <button key={g.key} type="button" className={`feed-sort-link ${group === g.key ? 'active' : ''}`} onClick={() => { setGroup(g.key); setAll(false); }}>
              {g.label} <span className="pill-count">{g.list.length}</span>
            </button>
          ))}
        </nav>
        <input className="follow-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter sources" />
      </div>

      {shown.length === 0 ? <p className="field-hint">No sources match.</p> : (
        <ul className="follow-list">
          {(all || needle ? shown : shown.slice(0, PAGE)).map((s) => {
            const h = health(s);
            return (
              <li key={s.source_id}>
                <button type="button" className="follow-row" onClick={() => setEditing(s)}>
                  <SourceIcon type={s.source_type} size={28} />
                  <span className="follow-main">
                    <strong>{s.name.replace(/ — national procurement portal$/, '')}</strong>
                    <em>{typeMeta(s.source_type).label} · {country(s.country)}</em>
                  </span>
                  <span className={`follow-status ${h.cls}`}><span className={`account-state ${h.cls}`} />{h.note}</span>
                  <svg className="follow-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!all && !needle && shown.length > PAGE && (
        <button type="button" className="btn follow-more" onClick={() => setAll(true)}>Show all {shown.length}</button>
      )}

      <dialog ref={dialog} className="modal" onClose={() => setEditing(undefined)}
              onClick={(e) => { if (e.target === dialog.current) close(); }}>
        {editing !== undefined && <SourceForm key={editing?.source_id ?? 'new'} source={editing} countries={countries} onDone={close} />}
      </dialog>
    </section>
  );
}
