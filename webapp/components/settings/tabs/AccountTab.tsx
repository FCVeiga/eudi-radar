'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useT, useLocale } from '@/lib/i18n/client';
import type { Plan } from '@/lib/plans';
import { DeleteAccountForm } from '@/components/auth/ProfileForms';
import { ActionRow, Choices, LinkRow, ModalActions, Row, Section, useSave } from '../SettingsUI';
import { PlanPanel } from '../PlanPanel';
import McpTokens, { type TokenInfo } from '../McpTokens';
import {
  SettingsState, changeEmail, changePassword, connectGoogle, disconnectGoogle, logOutEverywhere,
  setBirthday, setGender,
} from '@/app/settings/actions';

const GENDERS = [
  { value: 'woman', label: 'Woman' }, { value: 'man', label: 'Man' }, { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' }, { value: 'prefer_not', label: 'Prefer not to say' },
];

export default function AccountTab(p: {
  userId: string; username: string; email: string; hasPassword: boolean; google: string | null;
  birthday: string | null; gender: string | null;
  plan: { key: string; status: string; periodEnd: string | null; hasBilling: boolean };
  plans: Plan[]; billingReady: boolean; admin: boolean; openPlan: boolean; paid: boolean;
  tokens: TokenInfo[]; endpoint: string;
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
          {() => <PlanPanel userId={p.userId} plan={p.plan} plans={p.plans} admin={p.admin} current={current} />}
        </Row>
        <LinkRow label="Invoice history" href="/settings/account/invoices" />
      </Section>

      <Section title="Authorization">
        <ActionRow label="Google" hint={p.google ? t('Connected as {email}', { email: p.google }) : t('Log in with your Google account')}>
          <GoogleButton connected={!!p.google} />
        </ActionRow>
      </Section>

      <Section title="External agents">
        <McpTokens tokens={p.tokens} endpoint={p.endpoint} />
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
