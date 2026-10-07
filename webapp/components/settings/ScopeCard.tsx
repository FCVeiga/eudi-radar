'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setScopeActive, setShowDefault } from '@/app/workspaces/actions';
import { useT } from '@/lib/i18n/client';

/** A scope in the Settings list: name, what it holds, active switch, open. */
export default function ScopeCard({ scope, docs, agentsOn, agentsTotal, items, readOnly = false, canToggle, showDefaultFor }: {
  scope: { id: string; name: string; instructions: string | null; active: boolean; isDefault: boolean; topic: string | null };
  docs: number; agentsOn: number; agentsTotal: number; items: number; readOnly?: boolean;
  /** The default scope's switch hides it for this workspace instead of turning it off for everyone. */
  canToggle?: boolean; showDefaultFor?: string | null;
}) {
  const [on, setOn] = useState(scope.active);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const t = useT();
  const allowToggle = canToggle ?? !readOnly;
  return (
    <div className={`scope-card ${on ? '' : 'off'}`}>
      <div className="scope-card-head">
        <span className="scope-dot" aria-hidden="true" />
        {readOnly ? <span className="scope-card-name">{scope.name}</span> : <Link href={`/workspaces/scopes/${scope.id}`} className="scope-card-name">{scope.name}</Link>}
        {scope.isDefault && <span className="scope-badge" title={t('Visitors and people without an active scope see this scope’s results')}>{t('Default')}</span>}
        <button type="button" role="switch" aria-checked={on} disabled={!allowToggle} aria-label={`${scope.name} ${on ? t('active') : t('inactive')}`} className={`switch ${on ? 'on' : ''}`}
          onClick={() => {
            const next = !on; setOn(next); setError(null);
            start(async () => {
              const r = showDefaultFor ? await setShowDefault(showDefaultFor, next) : await setScopeActive(scope.id, next);
              if (r.error) { setOn(!next); setError(r.error); } else router.refresh();
            });
          }}><span /></button>
      </div>
      <p className="scope-card-text">{scope.instructions ? scope.instructions.slice(0, 180) + (scope.instructions.length > 180 ? '…' : '') : t('No instructions yet.')}</p>
      <div className="scope-card-meta">
        <span>{scope.topic ? t('Search: {topic}', { topic: scope.topic }) : t('Search: built-in EUDI Wallet')}</span>
        <span>{docs === 1 ? t('{n} context document', { n: docs }) : t('{n} context documents', { n: docs })}</span>
        <span>{t('{on}/{total} agents on', { on: agentsOn, total: agentsTotal })}</span>
        <span>{items === 1 ? t('{n} result', { n: items }) : t('{n} results', { n: items })}</span>
      </div>
      {error && <p className="form-msg err">{error}</p>}
      {!readOnly && <Link href={`/workspaces/scopes/${scope.id}`} className="btn scope-open">{t('Open scope')}</Link>}
    </div>
  );
}
