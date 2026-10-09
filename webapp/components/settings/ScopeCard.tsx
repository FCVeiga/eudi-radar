'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setCatalogPick, setScopeActive, setShowDefault } from '@/app/workspaces/actions';
import { useT } from '@/lib/i18n/client';
import { PlanPanel, type PlanState } from './PlanPanel';
import { PLANS, planOf } from '@/lib/plans';
import { Modal } from './SettingsUI';

/** A scope card: name, what it holds, active switch. `href` makes the card open that scope. */
export default function ScopeCard({ scope, docs, agentsOn, agentsTotal, items, readOnly = false, canToggle, showDefaultFor, catalogFor, atLimit, upgrade, href, bare = false }: {
  scope: { id: string; name: string; instructions: string | null; active: boolean; isDefault: boolean; catalog?: boolean; topic: string | null };
  docs: number; agentsOn: number; agentsTotal: number; items: number; readOnly?: boolean;
  /** Opens the scope page. The switch stays clickable on top of the card. */
  href?: string;
  /** The default scope's switch hides it for this workspace instead of turning it off for everyone. */
  canToggle?: boolean; showDefaultFor?: string | null;
  /** A shared scope: the switch turns it on for this workspace only. */
  catalogFor?: string | null;
  /** No scope slots left. Turning it on opens the plan. */
  atLimit?: boolean;
  upgrade?: { userId: string; admin: boolean; plan: PlanState } | null;
  /** Only the switch, for the scope page title. */
  bare?: boolean;
}) {
  const [on, setOn] = useState(scope.active);
  const [error, setError] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const t = useT();
  const allowToggle = canToggle ?? !readOnly;
  const name = <span className="scope-card-name" aria-hidden={href ? true : undefined}>{scope.name}</span>;
  const switchBtn = (
    <button type="button" role="switch" aria-checked={on} disabled={!allowToggle} aria-label={`${scope.name} ${on ? t('active') : t('inactive')}`} className={`switch ${on ? 'on' : ''}`}
      onClick={() => {
        if (!on && atLimit && upgrade) { setPlanOpen(true); return; }
        const next = !on; setOn(next); setError(null);
        start(async () => {
          const r: { error?: string; upgrade?: boolean } = showDefaultFor ? await setShowDefault(showDefaultFor, next)
            : catalogFor ? await setCatalogPick(catalogFor, scope.id, next)
              : await setScopeActive(scope.id, next);
          if (r.upgrade && upgrade) { setOn(!next); setPlanOpen(true); return; }
          if (r.error) { setOn(!next); setError(r.error); } else router.refresh();
        });
      }}><span /></button>
  );
  const plan = planOpen && upgrade && (
    <Modal title={t('Plan')} wide onClose={() => setPlanOpen(false)}>
      <PlanPanel userId={upgrade.userId} admin={upgrade.admin} plan={upgrade.plan} plans={PLANS} current={planOf(upgrade.plan.key)} />
    </Modal>
  );
  if (bare) {
    return (
      <div className="scope-title-switch">
        {switchBtn}
        {plan}
        {error && <p className="form-msg err">{error}</p>}
      </div>
    );
  }
  return (
    <div className={`scope-card ${on ? '' : 'off'}${href ? ' is-link' : ''}`}>
      {href && <Link href={href} className="scope-card-hit" aria-label={scope.name} />}
      <div className="scope-card-head">
        <span className="scope-dot" aria-hidden="true" />
        {name}
        {scope.isDefault && <span className="scope-badge" title={t('Visitors and people without an active scope see this scope’s results')}>{t('Default')}</span>}
        {switchBtn}
      </div>
      {plan}
      <p className="scope-card-text">{scope.instructions ? scope.instructions.slice(0, 180) + (scope.instructions.length > 180 ? '…' : '') : t('No instructions yet.')}</p>
      <div className="scope-card-meta">
        <span>{scope.topic ? t('Search: {topic}', { topic: scope.topic }) : t('Search: built-in EUDI Wallet')}</span>
        <span>{docs === 1 ? t('{n} context document', { n: docs }) : t('{n} context documents', { n: docs })}</span>
        <span>{t('{on}/{total} agents on', { on: agentsOn, total: agentsTotal })}</span>
        <span>{items === 1 ? t('{n} result', { n: items }) : t('{n} results', { n: items })}</span>
      </div>
      {error && <p className="form-msg err">{error}</p>}
    </div>
  );
}
