'use client';

import { useState, useTransition } from 'react';
import { useT, useLocale } from '@/lib/i18n/client';
import { PLANS, planOf, type Plan } from '@/lib/plans';
import { Modal } from './SettingsUI';
import { adminSetPlan, openBillingPortal, startCheckout } from '@/app/settings/actions';

export type PlanState = { key: string; status: string; periodEnd: string | null; hasBilling: boolean };

/** The plan picker from account settings. */
export function PlanPanel(p: { userId: string; plan: PlanState; plans: Plan[]; admin: boolean; current: Plan }) {
  const t = useT();
  const locale = useLocale();
  const date = (d: string | number) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string }>) => { setError(null); start(async () => { const r = await fn(); if (r?.error) setError(r.error); }); };
  return (
    <div className="st-plan">
      {p.plan.periodEnd && <p className="field-hint">{t('Renews {date}', { date: date(p.plan.periodEnd) })}</p>}
      <div className="plan-grid">
        {p.plans.map((pl) => {
          const on = pl.key === p.current.key;
          return (
            <div key={pl.key} className={`plan-card ${on ? 'current' : ''}`}>
              <div className="plan-head"><h3>{pl.name}</h3>{on && <span className="scope-badge">{t('Current')}</span>}</div>
              <p className="plan-price">€{pl.priceEur}<span>/{t('month')}</span></p>
              <p className="plan-blurb">{t(pl.blurb)}</p>
              <ul>{pl.features.map((f) => <li key={f}>{t(f)}</li>)}</ul>
              {!on && pl.key !== 'free' && (
                <button type="button" className="btn primary" disabled={pending} onClick={() => run(() => startCheckout(pl.key))}>
                  {pl.priceEur > p.current.priceEur ? t('Upgrade to {plan}', { plan: pl.name }) : t('Switch to {plan}', { plan: pl.name })}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="form-msg err">{error}</p>}
      <div className="billing-actions">
        {p.plan.hasBilling && <button type="button" className="btn" disabled={pending} onClick={() => run(openBillingPortal)}>{t('Manage billing')}</button>}
        {p.admin && (
          <label className="filter-select admin-plan">
            <span>{t('Set plan')}</span>
            <select defaultValue={p.current.key} onChange={(e) => run(() => adminSetPlan(p.userId, e.target.value))}>
              {p.plans.map((pl) => <option key={pl.key} value={pl.key}>{pl.name}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

/** Opens the plan modal. Used when the current plan blocks creating a scope or workspace. */
export function PlanUpgradeButton({ label, className = 'btn primary', autoOpen = false, userId, admin, plan }: {
  label: string; className?: string; autoOpen?: boolean; userId: string; admin: boolean; plan: PlanState;
}) {
  const t = useT();
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Modal title={t('Plan')} wide onClose={() => setOpen(false)}>
          <PlanPanel userId={userId} admin={admin} plan={plan} plans={PLANS} current={planOf(plan.key)} />
        </Modal>
      )}
    </>
  );
}
