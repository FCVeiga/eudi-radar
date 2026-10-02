'use client';

import { useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import { AuthState, createAvatarUpload, deleteAccount, setAvatar, updateProfile } from '@/app/auth/actions';

function Submit({ label, busy, danger }: { label: string; busy: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={`btn ${danger ? 'danger' : 'primary'}`} disabled={pending}>{pending ? busy : label}</button>;
}
const Msg = ({ state }: { state: AuthState }) => state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p>;

export function AvatarUpload({ username, src }: { username: string; src: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    const target = await createAvatarUpload(file.name, file.size);
    if ('error' in target) { setError(target.error ?? 'upload failed'); return; }
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    const res = await fetch(target.url!, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
    if (!res.ok) { setError(`upload failed (${res.status})`); return; }
    const done = await setAvatar(target.path!);
    if ('error' in done) setError(done.error ?? 'could not save');
    router.refresh();
  }

  return (
    <div className="avatar-upload">
      <UserAvatar name={username} src={src} size={72} />
      <div>
        <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : src ? 'Change picture' : 'Upload a picture'}</button>
        <p className="field-hint">PNG, JPG, WebP or GIF, up to 5 MB.</p>
        {error && <p className="form-msg err">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) start(() => upload(f)); e.target.value = ''; }} />
    </div>
  );
}

export function ProfileForm({ username, displayName, bio }: { username: string; displayName: string; bio: string }) {
  const [state, action] = useFormState<AuthState, FormData>(updateProfile, null);
  return (
    <form action={action} className="settings-form">
      <div className="field-row">
        <label className="field"><span>Display name</span><input name="display_name" defaultValue={displayName} maxLength={60} /></label>
        <label className="field"><span>Username <em>— u/name</em></span>
          <input name="username" defaultValue={username} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" title="3–24 letters, numbers or underscores" /></label>
      </div>
      <label className="field"><span>About <em>— shown on your profile</em></span>
        <textarea name="bio" defaultValue={bio} rows={4} maxLength={1000} placeholder="What you do, the markets you follow, what you bid on." /></label>
      <Msg state={state} />
      <div className="settings-actions"><Submit label="Save profile" busy="Saving…" /></div>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action] = useFormState<AuthState, FormData>(deleteAccount, null);
  return (
    <form action={action} className="settings-form">
      <p className="settings-intro">Deletes your account, profile, picture, the tenders and news you follow, and any posts and comments. This can’t be undone.</p>
      <label className="field"><span>Type <strong>{username}</strong> to confirm</span><input name="confirm" autoComplete="off" required /></label>
      <Msg state={state} />
      <div className="settings-actions"><Submit label="Delete my account" busy="Deleting…" danger /></div>
    </form>
  );
}
