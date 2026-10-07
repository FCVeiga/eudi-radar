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

/** Email and password: buttons that open the form for that change. */
export function AccountActions({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [open, setOpen] = useState<'email' | 'password' | null>(null);
  const toggle = (k: 'email' | 'password') => setOpen(open === k ? null : k);
  return (
    <div className="account-actions">
      <div className="account-row">
        <span className="account-email">{email}</span>
        <div className="account-buttons">
          <button type="button" className={`btn ${open === 'email' ? 'active' : ''}`} aria-expanded={open === 'email'} onClick={() => toggle('email')}>Change email</button>
          <button type="button" className={`btn ${open === 'password' ? 'active' : ''}`} aria-expanded={open === 'password'} onClick={() => toggle('password')}>
            {hasPassword ? 'Change password' : 'Set password'}
          </button>
          <LogOutEverywhere />
        </div>
      </div>
      {open === 'email' && <EmailForm needsPassword={hasPassword} onCancel={() => setOpen(null)} />}
      {open === 'password' && <PasswordForm hasPassword={hasPassword} onCancel={() => setOpen(null)} />}
    </div>
  );
}

function EmailForm({ needsPassword, onCancel }: { needsPassword: boolean; onCancel: () => void }) {
  const [state, action] = useFormState<SettingsState, FormData>(changeEmail, null);
  return (
    <form action={action} className="settings-form account-form">
      <label className="field"><span>New email</span><input name="email" type="email" autoComplete="email" required autoFocus /></label>
      {needsPassword && <label className="field"><span>Current password</span><input name="password" type="password" autoComplete="current-password" required /></label>}
      <Msg state={state} />
      <div className="settings-actions"><button type="button" className="btn" onClick={onCancel}>Cancel</button><Submit label="Save" busy="Saving…" /></div>
    </form>
  );
}

function PasswordForm({ hasPassword, onCancel }: { hasPassword: boolean; onCancel: () => void }) {
  const [state, action] = useFormState<SettingsState, FormData>(changePassword, null);
  return (
    <form action={action} className="settings-form account-form">
      {hasPassword && <label className="field"><span>Current password</span><input name="current" type="password" autoComplete="current-password" required autoFocus /></label>}
      <label className="field"><span>New password</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="field"><span>Confirm new password</span><input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      <Msg state={state} />
      <div className="settings-actions"><button type="button" className="btn" onClick={onCancel}>Cancel</button><Submit label="Save" busy="Saving…" /></div>
    </form>
  );
}

function LogOutEverywhere() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending}
      onClick={() => { if (confirm('Log out on every device, including this one?')) start(() => logOutEverywhere()); }}>
      {pending ? 'Logging out…' : 'Log out everywhere'}
    </button>
  );
}

/* ---------------- Chat ---------------- */

const CHAT_OPTIONS = [
  { value: 'everyone', label: 'Everyone', hint: '' },
  { value: 'workspace', label: 'People in my workspaces', hint: '' },
  { value: 'nobody', label: 'Nobody', hint: 'Existing chats carry on' },
];

export function ChatPermission({ value }: { value: string }) {
  const [v, setV] = useState(value);
  const [, start] = useTransition();
  return (
    <fieldset className="radio-list">
      <legend>Who can send you chat requests</legend>
      {CHAT_OPTIONS.map((o) => (
        <label key={o.value} className={`radio-row ${v === o.value ? 'on' : ''}`}>
          <input type="radio" name="chat_permission" value={o.value} checked={v === o.value}
            onChange={() => { setV(o.value); start(async () => { await setChatPermission(o.value); }); }} />
          <span><strong>{o.label}</strong>{o.hint && <em>{o.hint}</em>}</span>
        </label>
      ))}
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
        if (!confirm(`Switch the site to ${name}? Items not yet translated are hidden until the next runs.`)) return;
        start(async () => { const r = await setSiteLanguage(v); setMsg(r.error ? { ok: false, text: r.error } : null); router.refresh(); });
      }}>{pending ? 'Saving…' : 'Change'}</button>
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
