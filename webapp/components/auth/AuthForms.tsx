'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AuthState, continueWithGoogle, logIn, requestPasswordReset, signUp, updatePassword } from '@/app/auth/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary auth-submit" disabled={pending}>{pending ? busy : label}</button>;
}
const Msg = ({ state }: { state: AuthState }) => state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p>;

function GoogleButton({ next }: { next: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<AuthState>(null);
  return (
    <>
      <button type="button" className="btn auth-google" disabled={pending}
        onClick={() => start(async () => { const r = await continueWithGoogle(next); if (r) setMsg(r); })}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" /></svg>
        Continue with Google
      </button>
      <Msg state={msg} />
      <div className="auth-or"><span>or</span></div>
    </>
  );
}

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [state, action] = useFormState<AuthState, FormData>(logIn, error === 'link' ? { ok: false, message: 'That link has expired or was already used — try again.' } : null);
  return (
    <>
      <GoogleButton next={next} />
      <form action={action} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
        <Link className="auth-aside" href="/forgot-password">Forgot password?</Link>
        <Msg state={state} />
        <Submit label="Log in" busy="Logging in…" />
      </form>
      <p className="auth-switch">New to EUDI Radar? <Link href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign up</Link></p>
    </>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useFormState<AuthState, FormData>(signUp, null);
  return (
    <>
      <GoogleButton next={next} />
      <form action={action} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
        <label className="field">
          <span>Username <em>— shown as u/name</em></span>
          <input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}"
            title="3–24 letters, numbers or underscores" />
        </label>
        <label className="field"><span>Password <em>— at least 8 characters</em></span><input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
        <label className="field"><span>Confirm password</span><input name="confirm" type="password" autoComplete="new-password" required minLength={8} /></label>
        <p className="auth-legal">By signing up you agree to our <Link href="/terms">Terms &amp; Conditions</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
        <Msg state={state} />
        <Submit label="Sign up" busy="Creating your account…" />
      </form>
      <p className="auth-switch">Already have an account? <Link href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Log in</Link></p>
    </>
  );
}

export function ForgotForm() {
  const [state, action] = useFormState<AuthState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="auth-form">
      <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
      <Msg state={state} />
      <Submit label="Send reset link" busy="Sending…" />
      <p className="auth-switch"><Link href="/login">Back to log in</Link></p>
    </form>
  );
}

export function NewPasswordForm({ then }: { then?: 'home' }) {
  const [state, action] = useFormState<AuthState, FormData>(updatePassword, null);
  return (
    <form action={action} className="auth-form">
      {then && <input type="hidden" name="then" value={then} />}
      <label className="field"><span>New password</span><input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
      <label className="field"><span>Confirm new password</span><input name="confirm" type="password" autoComplete="new-password" required minLength={8} /></label>
      <Msg state={state} />
      <Submit label="Save password" busy="Saving…" />
    </form>
  );
}
