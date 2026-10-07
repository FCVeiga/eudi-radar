'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import UserAvatar from '@/components/UserAvatar';
import { AvatarUpload } from '@/components/auth/ProfileForms';
import { ModalActions, Row, Section, useSave } from '../SettingsUI';
import { setBio, setDisplayName, setSocialLinks, setWorkDetails } from '@/app/settings/actions';

type Links = { website: string; linkedin: string; x: string; github: string };
type Work = { company: string; role: string; location: string; expertise: string };

export default function ProfileTab({ username, displayName, bio, avatarUrl, links, work }: {
  username: string; displayName: string; bio: string; avatarUrl: string | null; links: Links; work: Work;
}) {
  const t = useT();
  const linkCount = Object.values(links).filter(Boolean).length;
  return (
    <Section title="General">
      <Row label="Display name" hint="Shown on your posts, comments and profile" value={displayName}>
        {(close) => <TextForm value={displayName} max={60} label="Display name" onSave={setDisplayName} close={close} />}
      </Row>
      <Row label="About description" hint="A short bio on your profile" value={bio ? `${bio.slice(0, 40)}${bio.length > 40 ? '…' : ''}` : t('Not set')}>
        {(close) => <TextForm value={bio} max={1000} label="About description" multiline onSave={setBio} close={close} />}
      </Row>
      <Row label="Avatar" hint="Images must be PNG, JPG, WebP or GIF" value={<UserAvatar name={username} src={avatarUrl} size={28} />}>
        {(close) => <div className="settings-form"><AvatarUpload username={username} src={avatarUrl} /><div className="modal-actions"><button type="button" className="btn primary" onClick={close}>{t('Done')}</button></div></div>}
      </Row>
      <Row label="Work details" hint="Company, role, location and expertise" value={work.company || t('Not set')}>
        {(close) => <WorkForm v={work} close={close} />}
      </Row>
      <Row label="Social links" hint="LinkedIn, X, GitHub and your website" value={linkCount ? String(linkCount) : t('Not set')}>
        {(close) => <LinksForm v={links} close={close} />}
      </Row>
    </Section>
  );
}

function TextForm({ value, max, label, multiline = false, onSave, close }: {
  value: string; max: number; label: string; multiline?: boolean; onSave: (v: string) => Promise<{ error?: string }>; close: () => void;
}) {
  const t = useT();
  const [v, setV] = useState(value);
  const { pending, error, save } = useSave(close);
  return (
    <form className="settings-form" onSubmit={(e) => { e.preventDefault(); save(() => onSave(v)); }}>
      <label className="field">
        <span className="sr-only">{t(label)}</span>
        {multiline ? <textarea rows={5} value={v} onChange={(e) => setV(e.target.value)} maxLength={max} autoFocus />
          : <input value={v} onChange={(e) => setV(e.target.value)} maxLength={max} autoFocus />}
      </label>
      <p className="field-hint st-count">{v.length}/{max}</p>
      {error && <p className="form-msg err">{error}</p>}
      <ModalActions close={close} pending={pending} />
    </form>
  );
}

function WorkForm({ v, close }: { v: Work; close: () => void }) {
  const t = useT();
  const [s, set] = useState(v);
  const { pending, error, save } = useSave(close);
  const field = (k: keyof Work, label: string, placeholder = '') => (
    <label className="field"><span>{t(label)}</span><input value={s[k]} onChange={(e) => set({ ...s, [k]: e.target.value })} maxLength={k === 'expertise' ? 600 : 100} placeholder={placeholder} /></label>
  );
  return (
    <form className="settings-form" onSubmit={(e) => { e.preventDefault(); save(() => setWorkDetails(s)); }}>
      {field('company', 'Company')}
      {field('role', 'Role')}
      {field('location', 'Location')}
      {field('expertise', 'Expertise', t('Comma-separated, e.g. eIDAS, wallets'))}
      {error && <p className="form-msg err">{error}</p>}
      <ModalActions close={close} pending={pending} />
    </form>
  );
}

function LinksForm({ v, close }: { v: Links; close: () => void }) {
  const t = useT();
  const [s, set] = useState(v);
  const { pending, error, save } = useSave(close);
  const field = (k: keyof Links, label: string, placeholder: string) => (
    <label className="field"><span>{label}</span><input value={s[k]} onChange={(e) => set({ ...s, [k]: e.target.value })} placeholder={placeholder} autoComplete="off" /></label>
  );
  return (
    <form className="settings-form" onSubmit={(e) => { e.preventDefault(); save(() => setSocialLinks(s)); }}>
      {field('linkedin', 'LinkedIn', 'linkedin.com/in/…')}
      {field('x', 'X', '@handle')}
      {field('github', 'GitHub', t('username'))}
      {field('website', t('Website'), 'https://…')}
      {error && <p className="form-msg err">{error}</p>}
      <ModalActions close={close} pending={pending} />
    </form>
  );
}
