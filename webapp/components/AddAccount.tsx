'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { addAccount, AddAccountState } from '@/app/actions';
import { CATEGORIES, PLATFORMS, Platform } from '@/lib/platforms';
import PlatformIcon from './PlatformIcon';

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? 'Connecting…' : 'Follow account'}</button>;
}

export default function AddAccount() {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>('news');
  const [state, action] = useFormState<AddAccountState, FormData>(addAccount, null);

  useEffect(() => {
    if (!state?.ok) return;
    form.current?.reset();
    router.refresh();
    const t = setTimeout(() => dialog.current?.close(), 1400);
    return () => clearTimeout(t);
  }, [state, router]);

  return (
    <>
      <button type="button" className="btn add-account" onClick={() => dialog.current?.showModal()}>
        <span aria-hidden="true">+</span> Add account
      </button>
      <dialog ref={dialog} className="modal" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <form ref={form} action={action} className="modal-body">
          <div className="modal-head">
            <h2>Follow an account</h2>
            <button type="button" className="modal-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
          </div>

          <fieldset className="field">
            <legend>Platform</legend>
            <div className="platform-picker">
              {(Object.keys(PLATFORMS) as Platform[]).map((p) => (
                <label key={p} className={`platform-option ${platform === p ? 'active' : ''}`}>
                  <input type="radio" name="platform" value={p} checked={platform === p} onChange={() => setPlatform(p)} />
                  <PlatformIcon platform={p} size={20} />
                  {PLATFORMS[p].label}
                </label>
              ))}
            </div>
            {!PLATFORMS[platform].connectable && (
              <p className="field-hint">{PLATFORMS[platform].label} has no free feed: the account is listed, and its activity shows once API access is set up.</p>
            )}
          </fieldset>

          <label className="field">
            <span>{platform === 'news' ? 'Website or feed URL' : platform === 'reddit' ? 'Subreddit or user' : 'Handle or profile URL'}</span>
            <input name="handle" required placeholder={PLATFORMS[platform].placeholder} autoComplete="off" />
          </label>
          <label className="field">
            <span>Display name <em>(optional)</em></span>
            <input name="display_name" placeholder="e.g. Biometric Update" autoComplete="off" />
          </label>
          <label className="field">
            <span>Category</span>
            <select name="category" defaultValue={platform === 'reddit' ? 'COMMUNITY' : 'MEDIA'} key={platform}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ').toLowerCase()}</option>)}
            </select>
          </label>

          {state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
            <Submit />
          </div>
        </form>
      </dialog>
    </>
  );
}
