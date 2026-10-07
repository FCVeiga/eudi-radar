'use client';

import { useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import { AuthState, createAvatarUpload, deleteAccount, setAvatar, updateProfile, updateProfileDetails } from '@/app/auth/actions';
import { useT } from '@/lib/i18n/client';

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
  const t = useT();

  async function upload(file: File) {
    setError(null);
    const target = await createAvatarUpload(file.name, file.size);
    if ('error' in target) { setError(target.error ?? t('Upload failed')); return; }
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    const res = await fetch(target.url!, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
    if (!res.ok) { setError(t('Upload failed ({status})', { status: res.status })); return; }
    const done = await setAvatar(target.path!);
    if ('error' in done) setError(done.error ?? t('Could not save'));
    router.refresh();
  }

  return (
    <div className="avatar-upload">
      <UserAvatar name={username} src={src} size={72} />
      <div>
        <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? t('Uploading…') : src ? t('Change picture') : t('Upload a picture')}</button>
        <p className="field-hint">{t('PNG, JPG, WebP or GIF, up to 5 MB.')}</p>
        {error && <p className="form-msg err">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) start(() => upload(f)); e.target.value = ''; }} />
    </div>
  );
}

export function ProfileForm({ username, displayName, bio }: { username: string; displayName: string; bio: string }) {
  const t = useT();
  const [state, action] = useFormState<AuthState, FormData>(updateProfile, null);
  return (
    <form action={action} className="settings-form">
      <div className="field-row">
        <label className="field"><span>{t('Display name')}</span><input name="display_name" defaultValue={displayName} maxLength={60} /></label>
        <label className="field"><span>{t('Username')} <em>{t('— u/name')}</em></span>
          <input name="username" defaultValue={username} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" title={t('3–24 letters, numbers or underscores')} /></label>
      </div>
      <label className="field"><span>{t('About')} <em>{t('— shown on your profile')}</em></span>
        <textarea name="bio" defaultValue={bio} rows={4} maxLength={1000} placeholder={t('What you do, the markets you follow, what you bid on.')} /></label>
      <Msg state={state} />
      <div className="settings-actions"><Submit label={t('Save profile')} busy={t('Saving…')} /></div>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const t = useT();
  const [state, action] = useFormState<AuthState, FormData>(deleteAccount, null);
  const confirm = t('Type {username} to confirm', { username: '\u0000' }).split('\u0000');
  return (
    <form action={action} className="settings-form">
      <p className="field-hint">{t('Deletes your account, posts, comments and the workspaces you own. This can’t be undone.')}</p>
      <label className="field"><span>{confirm[0]}<strong>{username}</strong>{confirm[1]}</span><input name="confirm" autoComplete="off" required /></label>
      <Msg state={state} />
      <div className="settings-actions"><Submit label={t('Delete my account')} busy={t('Deleting…')} danger /></div>
    </form>
  );
}

export function ProfileDetailsForm({ v }: { v: { company: string; role: string; location: string; expertise: string; website: string; linkedin: string; x: string; github: string } }) {
  const t = useT();
  const [state, action] = useFormState<AuthState, FormData>(updateProfileDetails, null);
  return (
    <form action={action} className="settings-form">
      <div className="field-row">
        <label className="field"><span>{t('Company')}</span><input name="company" defaultValue={v.company} maxLength={100} placeholder={t('e.g. {example}', { example: 'Acme Systems' })} /></label>
        <label className="field"><span>{t('Role')}</span><input name="role" defaultValue={v.role} maxLength={100} placeholder={t('e.g. Head of Public Sector')} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>{t('Location')}</span><input name="location" defaultValue={v.location} maxLength={100} placeholder={t('e.g. Lisbon, Portugal')} /></label>
        <label className="field"><span>{t('Expertise')} <em>{t('— comma separated')}</em></span><input name="expertise" defaultValue={v.expertise} maxLength={600} placeholder={t('e.g. EUDI Wallet, eIDAS, public procurement')} /></label>
      </div>
      <h3 className="form-subhead" id="links">{t('Social links')}</h3>
      <div className="field-row">
        <label className="field"><span>LinkedIn</span><input name="linkedin" defaultValue={v.linkedin} placeholder={t('linkedin.com/in/yourname')} /></label>
        <label className="field"><span>X (Twitter)</span><input name="x" defaultValue={v.x} placeholder={t('@handle or x.com/handle')} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>GitHub</span><input name="github" defaultValue={v.github} placeholder={t('username or github.com/username')} /></label>
        <label className="field"><span>{t('Website')}</span><input name="website" defaultValue={v.website} placeholder={t('yourcompany.com')} /></label>
      </div>
      <Msg state={state} />
      <div className="settings-actions"><Submit label={t('Save details')} busy={t('Saving…')} /></div>
    </form>
  );
}
