'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SOURCE_GROUPS, Source, typeMeta } from '@/lib/sourceMeta';
import SourceIcon from '@/components/SourceIcon';
import { Country, SourceForm, health } from '@/components/SourcesPanel';
import { setSourceFollowed } from '@/app/actions';
import { useLocale, useT } from '@/lib/i18n/client';

const PAGE = 12;
type Modal = { kind: 'edit'; source: Source } | { kind: 'add' } | null;

/** Scope page → Following: the sources this scope follows; follow more from the registry, add new ones, unfollow. */
export default function FollowingSection({ scopeId, sources, followed, countries, readOnly = false }: {
  scopeId: string; sources: Source[]; followed: string[]; countries: Country[]; readOnly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [group, setGroup] = useState<string>('all');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [following, setFollowing] = useState(new Set(followed));
  const [, start] = useTransition();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  useEffect(() => setFollowing(new Set(followed)), [followed]);
  useEffect(() => { if (modal) dialog.current?.showModal(); }, [modal]);
  const close = () => { dialog.current?.close(); setModal(null); };

  const toggle = (id: string, on: boolean) => {
    const next = new Set(following);
    if (on) next.add(id); else next.delete(id);
    setFollowing(next);
    start(async () => { const r = await setSourceFollowed(scopeId, id, on); if (r.error) { setFollowing(following); alert(r.error); } else router.refresh(); });
  };

  const mine = sources.filter((s) => following.has(s.source_id));
  const monitored = mine.filter((s) => s.enabled && s.method !== 'off').length;
  const groups = SOURCE_GROUPS.map((g) => ({ ...g, list: mine.filter((s) => (g.types as readonly string[]).includes(s.source_type)) })).filter((g) => g.list.length);
  const needle = q.trim().toLowerCase();
  const match = (s: Source) => !needle || `${s.name} ${s.url ?? ''} ${s.handle ?? ''} ${s.country ?? ''}`.toLowerCase().includes(needle);
  const shown = (group === 'all' ? mine : groups.find((g) => g.key === group)?.list ?? []).filter(match).sort((a, b) => a.name.localeCompare(b.name));
  const country = (code: string | null) => (code ? countries.find((c) => c.code === code)?.name ?? code : t('International'));

  return (
    <section className="detail-block" id="following">
      <div className="section-head">
        <h2>{t('Following')} <span className="uc-count" title={t('Monitored of followed')}>{monitored}/{mine.length}</span></h2>
        {!readOnly && <button type="button" className="btn primary" onClick={() => setModal({ kind: 'add' })}>{t('Add source')}</button>}
      </div>

      <div className="follow-toolbar">
        <nav className="feed-sort follow-groups" aria-label={t('Source groups')}>
          <button type="button" className={`feed-sort-link ${group === 'all' ? 'active' : ''}`} onClick={() => { setGroup('all'); setAll(false); }}>
            {t('All')} <span className="pill-count">{mine.length}</span>
          </button>
          {groups.map((g) => (
            <button key={g.key} type="button" className={`feed-sort-link ${group === g.key ? 'active' : ''}`} onClick={() => { setGroup(g.key); setAll(false); }}>
              {t(g.label)} <span className="pill-count">{g.list.length}</span>
            </button>
          ))}
        </nav>
        <input className="follow-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Filter')} aria-label={t('Filter sources')} />
      </div>

      {shown.length === 0 ? <p className="field-hint">{mine.length ? t('No sources match.') : t('Not following any sources yet.')}</p> : (
        <ul className="follow-list">
          {(all || needle ? shown : shown.slice(0, PAGE)).map((s) => {
            const h = health(s, t, locale);
            return (
              <li key={s.source_id} className="follow-item">
                {readOnly ? (
                  <span className="follow-row static">
                    <SourceIcon type={s.source_type} size={28} />
                    <span className="follow-main">
                      <strong>{s.name.replace(/ — national procurement portal$/, '')}</strong>
                      <em>{t(typeMeta(s.source_type).label)} · {country(s.country)}</em>
                    </span>
                    <span className={`follow-status ${h.cls}`}><span className={`account-state ${h.cls}`} />{h.note}</span>
                  </span>
                ) : (
                  <button type="button" className="follow-row" onClick={() => setModal({ kind: 'edit', source: s })}>
                    <SourceIcon type={s.source_type} size={28} />
                    <span className="follow-main">
                      <strong>{s.name.replace(/ — national procurement portal$/, '')}</strong>
                      <em>{t(typeMeta(s.source_type).label)} · {country(s.country)}</em>
                    </span>
                    <span className={`follow-status ${h.cls}`}><span className={`account-state ${h.cls}`} />{h.note}</span>
                  </button>
                )}
                {!readOnly && <button type="button" className="follow-unfollow" aria-label={t('Unfollow {name}', { name: s.name })} title={t('Unfollow')} onClick={() => toggle(s.source_id, false)}>
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>}
              </li>
            );
          })}
        </ul>
      )}
      {!all && !needle && shown.length > PAGE && (
        <button type="button" className="btn follow-more" onClick={() => setAll(true)}>{t('Show all {n}', { n: shown.length })}</button>
      )}

      <dialog ref={dialog} className="modal" onClose={() => setModal(null)} onClick={(e) => { if (e.target === dialog.current) close(); }}>
        {modal?.kind === 'edit' && <SourceForm key={modal.source.source_id} source={modal.source} countries={countries} onDone={close} />}
        {modal?.kind === 'add' && <AddSource sources={sources} following={following} countries={countries} scopeId={scopeId} onFollow={(id) => toggle(id, true)} onDone={close} />}
      </dialog>
    </section>
  );
}

/** Add source: follow one from the shared registry, or create a new one. */
function AddSource({ sources, following, countries, scopeId, onFollow, onDone }: {
  sources: Source[]; following: Set<string>; countries: Country[]; scopeId: string; onFollow: (id: string) => void; onDone: () => void;
}) {
  const [tab, setTab] = useState<'browse' | 'new'>('browse');
  const [q, setQ] = useState('');
  const t = useT();
  if (tab === 'new') return <SourceForm source={null} countries={countries} onDone={onDone} scopeId={scopeId} />;
  const needle = q.trim().toLowerCase();
  const available = sources.filter((s) => !following.has(s.source_id))
    .filter((s) => !needle || `${s.name} ${s.url ?? ''} ${t(typeMeta(s.source_type).label)}`.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="modal-body">
      <div className="modal-head">
        <h2>{t('Add source')}</h2>
        <button type="button" className="modal-close" aria-label={t('Close')} onClick={onDone}>×</button>
      </div>
      <div className="follow-add-head">
        <input className="follow-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search sources')} aria-label={t('Search sources')} autoFocus />
        <button type="button" className="btn" onClick={() => setTab('new')}>{t('New source')}</button>
      </div>
      {available.length === 0 ? <p className="field-hint">{needle ? t('No sources match.') : t('Following every source already.')}</p> : (
        <ul className="follow-list follow-browse">
          {available.map((s) => (
            <li key={s.source_id} className="follow-item">
              <span className="follow-row static">
                <SourceIcon type={s.source_type} size={24} />
                <span className="follow-main"><strong>{s.name.replace(/ — national procurement portal$/, '')}</strong><em>{t(typeMeta(s.source_type).label)}</em></span>
              </span>
              <button type="button" className="btn follow-btn" onClick={() => onFollow(s.source_id)}>{t('Follow')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
