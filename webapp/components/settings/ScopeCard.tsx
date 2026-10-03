'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setScopeActive } from '@/app/settings/actions';

/** A scope in the Settings list: name, what it holds, active switch, open. */
export default function ScopeCard({ scope, docs, agentsOn, agentsTotal, items }: {
  scope: { id: string; name: string; instructions: string | null; active: boolean; isDefault: boolean; topic: string | null };
  docs: number; agentsOn: number; agentsTotal: number; items: number;
}) {
  const [on, setOn] = useState(scope.active);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <div className={`scope-card ${on ? '' : 'off'}`}>
      <div className="scope-card-head">
        <span className="scope-dot" aria-hidden="true" />
        <Link href={`/settings/scopes/${scope.id}`} className="scope-card-name">{scope.name}</Link>
        {scope.isDefault && <span className="scope-badge" title="Visitors and people without an active scope see this scope’s results">Default</span>}
        <button type="button" role="switch" aria-checked={on} aria-label={`${scope.name} ${on ? 'active' : 'inactive'}`} className={`switch ${on ? 'on' : ''}`}
          onClick={() => {
            const next = !on; setOn(next); setError(null);
            start(async () => { const r = await setScopeActive(scope.id, next); if (r.error) { setOn(!next); setError(r.error); } else router.refresh(); });
          }}><span /></button>
      </div>
      <p className="scope-card-text">{scope.instructions ? scope.instructions.slice(0, 180) + (scope.instructions.length > 180 ? '…' : '') : 'No instructions yet.'}</p>
      <div className="scope-card-meta">
        <span>{scope.topic ? `Search: ${scope.topic}` : 'Search: built-in EUDI Wallet'}</span>
        <span>{docs} context {docs === 1 ? 'document' : 'documents'}</span>
        <span>{agentsOn}/{agentsTotal} agents on</span>
        <span>{items} results</span>
      </div>
      {error && <p className="form-msg err">{error}</p>}
      <Link href={`/settings/scopes/${scope.id}`} className="btn scope-open">Open scope</Link>
    </div>
  );
}
