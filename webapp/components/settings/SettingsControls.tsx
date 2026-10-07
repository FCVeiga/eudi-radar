'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  SettingsState, adminSetPlan, changeEmail, changePassword, logOutEverywhere, openBillingPortal, setChatPermission, setSiteLanguage, startCheckout,
} from '@/app/settings/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
}
const Msg = ({ state }: { state: SettingsState }) => state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p>;

/* ---------------- Account ---------------- */

export function EmailForm({ email, needsPassword }: { email: string; needsPassword: boolean }) {
  const [state, action] = useFormState<SettingsState, FormData>(changeEmail, null);
  return (
    <form action={action} className="settings-form">
      <div className="field-row">
        <label className="field"><span>New email</span><input name="email" type="email" autoComplete="email" placeholder={email} required /></label>
        {needsPassword && <label className="field"><span>Current password</span><input name="password" type="password" autoComplete="current-password" required /></label>}
      </div>
      <Msg state={state} />
      <div className="settings-actions"><Submit label="Change email" busy="Saving…" /></div>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useFormState<SettingsState, FormData>(changePassword, null);
  return (
    <form action={action} className="settings-form" key={state?.ok ? 'done' : 'form'}>
      {hasPassword && <label className="field"><span>Current password</span><input name="current" type="password" autoComplete="current-password" required /></label>}
      <div className="field-row">
        <label className="field"><span>New password</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label className="field"><span>Confirm new password</span><input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      </div>
      <Msg state={state} />
      <div className="settings-actions"><Submit label={hasPassword ? 'Change password' : 'Set password'} busy="Saving…" /></div>
    </form>
  );
}

export function LogOutEverywhere() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending}
      onClick={() => { if (confirm('Log out on every browser and device, this one included?')) start(() => logOutEverywhere()); }}>
      {pending ? 'Logging out…' : 'Log out everywhere'}
    </button>
  );
}

/* ---------------- Chat ---------------- */

const CHAT_OPTIONS = [
  { value: 'everyone', label: 'Everyone', hint: 'Any member can send you a chat request.' },
  { value: 'workspace', label: 'People in my workspaces', hint: 'Only people who share a workspace with you.' },
  { value: 'nobody', label: 'Nobody', hint: 'No new chat requests. Existing chats carry on.' },
];

export function ChatPermission({ value }: { value: string }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();
  return (
    <fieldset className="radio-list">
      <legend>Who can send you chat requests</legend>
      {CHAT_OPTIONS.map((o) => (
        <label key={o.value} className={`radio-row ${v === o.value ? 'on' : ''}`}>
          <input type="radio" name="chat_permission" value={o.value} checked={v === o.value}
            onChange={() => { setV(o.value); setSaved(false); start(async () => { await setChatPermission(o.value); setSaved(true); }); }} />
          <span><strong>{o.label}</strong><em>{o.hint}</em></span>
        </label>
      ))}
      {saved && <p className="form-msg ok" role="status">Saved.</p>}
    </fieldset>
  );
}

/* ---------------- Language ---------------- */

export function SiteLanguage({ code, options }: { code: string; options: { code: string; name: string }[] }) {
  const [v, setV] = useState(code);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="inline-form">
      <select value={v} onChange={(e) => setV(e.target.value)} aria-label="Site language" disabled={pending}>
        {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
      </select>
      <button type="button" className="btn primary" disabled={pending || v === code} onClick={() => {
        const name = options.find((o) => o.code === v)?.name;
        if (!confirm(`Switch the whole site to ${name}? The agents translate into it from their next runs; until then, items not yet translated are hidden.`)) return;
        start(async () => { const r = await setSiteLanguage(v); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: `The site language is now ${name}.` }); router.refresh(); });
      }}>{pending ? 'Saving…' : 'Change language'}</button>
      {msg && <p className={`form-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
    </div>
  );
}

/* ---------------- Plan ---------------- */

export function PlanButton({ plan, label }: { plan: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn primary" disabled={pending} onClick={() => start(async () => { const r = await startCheckout(plan); if (r?.error) setError(r.error); })}>
        {pending ? 'Opening checkout…' : label}
      </button>
      {error && <p className="form-msg err">{error}</p>}
    </>
  );
}

export function PortalButton({ label = 'Manage billing' }: { label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn" disabled={pending} onClick={() => start(async () => { const r = await openBillingPortal(); if (r?.error) setError(r.error); })}>
        {pending ? 'Opening…' : label}
      </button>
      {error && <p className="form-msg err">{error}</p>}
    </>
  );
}

/** Internal tool: set a plan by hand (complimentary). */
export function SetPlan({ userId, plan, options }: { userId: string; plan: string; options: { key: string; name: string }[] }) {
  const [value, setValue] = useState(plan);
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <label className="filter-select admin-plan">
      <span>Set plan</span>
      <select value={value} onChange={(e) => { const v = e.target.value; setValue(v); start(async () => { await adminSetPlan(userId, v); router.refresh(); }); }}>
        {options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
      </select>
    </label>
  );
}
