'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useT, useLocale } from '@/lib/i18n/client';
import type { Plan } from '@/lib/plans';
import { DeleteAccountForm } from '@/components/auth/ProfileForms';
import { ActionRow, Choices, ModalActions, Row, Section, useSave } from '../SettingsUI';
import {
  SettingsState, adminSetPlan, changeEmail, changePassword, connectGoogle, disconnectGoogle, logOutEverywhere,
  openBillingPortal, setBirthday, setGender, startCheckout,
} from '@/app/settings/actions';

const GENDERS = [
  { value: 'woman', label: 'Woman' }, { value: 'man', label: 'Man' }, { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' }, { value: 'prefer_not', label: 'Prefer not to say' },
];

type Invoice = { id: string; number: string | null; date: number; amount: number; currency: string; status: string | null; url: string | null };

export default function AccountTab(p: {
  userId: string; username: string; email: string; hasPassword: boolean; google: string | null;
  birthday: string | null; gender: string | null;
  plan: { key: string; status: string; periodEnd: string | null; hasBilling: boolean };
  plans: Plan[]; invoices: Invoice[]; billingReady: boolean; admin: boolean; openPlan: boolean; paid: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const date = (d: string | number) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const current = p.plans.find((x) => x.key === p.plan.key) ?? p.plans[0];

  return (
    <>
      {p.paid && <p className="form-msg ok">{t('Payment received — your plan updates in a few seconds.')}</p>}
      <Section title="General">
        <Row label="Email address" value={p.email}>{(close) => <EmailForm needsPassword={p.hasPassword} close={close} />}</Row>
        <Row label="Password" title={p.hasPassword ? 'Change password' : 'Set password'} value={p.hasPassword ? '••••••••' : t('Not set')}>
          {(close) => <PasswordForm hasPassword={p.hasPassword} close={close} />}
        </Row>
        <Row label="Birthday" value={p.birthday ? date(`${p.birthday}T00:00:00`) : t('Not set')}>{(close) => <BirthdayForm value={p.birthday} close={close} />}</Row>
        <Row label="Gender" value={t(GENDERS.find((g) => g.value === p.gender)?.label ?? 'Not set')}>
          {(close) => <Choices options={GENDERS} value={p.gender} onPick={(v) => setGender(v)} close={close} />}
        </Row>
      </Section>

      <Section title="Subscription">
        <Row label="Plan" value={`${current.name}${p.plan.status === 'comped' ? ` · ${t('complimentary')}` : ''}`} autoOpen={p.openPlan} wide>
          {() => <PlanPanel {...p} current={current} date={date} />}
        </Row>
      </Section>

      <Section title="Authorization">
        <ActionRow label="Google" hint={p.google ? t('Connected as {email}', { email: p.google }) : t('Log in with your Google account')}>
          <GoogleButton connected={!!p.google} />
        </ActionRow>
      </Section>

      <Section title="Advanced">
        <ActionRow label="Log out everywhere" hint={t('Ends every session, this one included')}><LogOutButton /></ActionRow>
        <Row label="Delete account">{() => <DeleteAccountForm username={p.username} />}</Row>
      </Section>
    </>
  );
}

function Msg({ state }: { state: SettingsState }) {
  return state ? <p className={`form-msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p> : null;
}

function FormActions({ close }: { close: () => void }) {
  const { pending } = useFormStatus();
  return <ModalActions close={close} pending={pending} />;
}

function EmailForm({ needsPassword, close }: { needsPassword: boolean; close: () => void }) {
  const t = useT();
  const [state, action] = useFormState<SettingsState, FormData>(changeEmail, null);
  return (
    <form action={action} className="settings-form">
      <label className="field"><span>{t('New email')}</span><input name="email" type="email" autoComplete="email" required autoFocus /></label>
      {needsPassword && <label className="field"><span>{t('Current password')}</span><input name="password" type="password" autoComplete="current-password" required /></label>}
      <Msg state={state} />
      {state?.ok ? <div className="modal-actions"><button type="button" className="btn primary" onClick={close}>{t('Done')}</button></div> : <FormActions close={close} />}
    </form>
  );
}

function PasswordForm({ hasPassword, close }: { hasPassword: boolean; close: () => void }) {
  const t = useT();
  const [state, action] = useFormState<SettingsState, FormData>(changePassword, null);
  return (
    <form action={action} className="settings-form">
      {hasPassword && <label className="field"><span>{t('Current password')}</span><input name="current" type="password" autoComplete="current-password" required autoFocus /></label>}
      <label className="field"><span>{t('New password')}</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="field"><span>{t('Confirm new password')}</span><input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      <Msg state={state} />
      {state?.ok ? <div className="modal-actions"><button type="button" className="btn primary" onClick={close}>{t('Done')}</button></div> : <FormActions close={close} />}
    </form>
  );
}

function BirthdayForm({ value, close }: { value: string | null; close: () => void }) {
  const t = useT();
  const [v, setV] = useState(value ?? '');
  const { pending, error, save } = useSave(close);
  return (
    <form className="settings-form" onSubmit={(e) => { e.preventDefault(); save(() => setBirthday(v || null)); }}>
      <label className="field"><span>{t('Date of birth')}</span><input type="date" value={v} onChange={(e) => setV(e.target.value)} max={new Date().toISOString().slice(0, 10)} autoFocus /></label>
      <p className="field-hint">{t('Not shown on your profile.')}</p>
      {error && <p className="form-msg err">{error}</p>}
      <ModalActions close={close} pending={pending} />
    </form>
  );
}

function GoogleButton({ connected }: { connected: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={`btn ${connected ? '' : 'primary'}`} disabled={pending}
        onClick={() => { setError(null); start(async () => { const r = await (connected ? disconnectGoogle() : connectGoogle()); if (r?.error) setError(r.error); }); }}>
        {pending ? '…' : connected ? t('Disconnect') : t('Connect')}
      </button>
      {error && <span className="st-action-error">{error}</span>}
    </>
  );
}

function LogOutButton() {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending}
      onClick={() => { if (confirm(t('Log out on every device, including this one?'))) start(() => logOutEverywhere()); }}>
      {t('Log out')}
    </button>
  );
}

function PlanPanel(p: {
  userId: string; plan: { key: string; status: string; periodEnd: string | null; hasBilling: boolean };
  plans: Plan[]; invoices: Invoice[]; billingReady: boolean; admin: boolean; current: Plan; date: (d: string | number) => string;
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const money = (cents: number, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  const run = (fn: () => Promise<{ error?: string }>) => { setError(null); start(async () => { const r = await fn(); if (r?.error) setError(r.error); }); };
  return (
    <div className="st-plan">
      {p.plan.periodEnd && <p className="field-hint">{t('Renews {date}', { date: p.date(p.plan.periodEnd) })}</p>}
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
      <h3 className="form-subhead">{t('Invoices')}</h3>
      {p.invoices.length === 0 ? <p className="field-hint">{t('No invoices yet.')}</p> : (
        <ul className="st-invoices">
          {p.invoices.map((i) => (
            <li key={i.id}>
              <span>{p.date(i.date)}</span><span>{i.number ?? '—'}</span><span>{money(i.amount, i.currency)}</span>
              {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer">PDF</a> : <span />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
