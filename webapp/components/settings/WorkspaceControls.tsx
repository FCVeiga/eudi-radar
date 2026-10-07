'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import { useT } from '@/lib/i18n/client';
import {
  FormState, createWorkspace, deleteWorkspace, inviteMember, removeMember, renameWorkspace, revokeInvite, setMemberRole,
} from '@/app/workspaces/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
}
const Msg = ({ state }: { state: FormState }) => state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p>;

/* ---------------- Workspace ---------------- */

export function WorkspaceName({ id, name, canRename }: { id: string; name: string; canRename: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();
  if (editing) {
    return (
      <form className="inline-form ws-rename" onSubmit={(e) => { e.preventDefault(); start(async () => { await renameWorkspace(id, value); setEditing(false); router.refresh(); }); }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} autoFocus aria-label={t('Workspace name')} />
        <button type="submit" className="btn primary" disabled={pending}>{t('Save')}</button>
        <button type="button" className="btn" onClick={() => { setEditing(false); setValue(name); }}>{t('Cancel')}</button>
      </form>
    );
  }
  return (
    <div className="ws-title">
      <h1 className="opps-h1">{name}</h1>
      {canRename && <button type="button" className="section-edit" aria-label={t('Rename workspace')} onClick={() => setEditing(true)}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.7a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5 2.5 13.5l1-3.1z" /></svg></button>}

      {error && <p className="form-msg err">{error}</p>}
    </div>
  );
}

/** A button that opens a modal; the modal's content gets a close callback. */
function ModalButton({ label, title, primary = true, autoOpen = false, children }: {
  label: string; title: string; primary?: boolean; autoOpen?: boolean; children: (close: () => void) => ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  const close = () => { dialog.current?.close(); setOpen(false); };
  const t = useT();
  return (
    <>
      <button type="button" className={`btn ${primary ? 'primary' : ''}`} onClick={() => setOpen(true)}>{label}</button>
      <dialog ref={dialog} className="modal" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === dialog.current) close(); }}>
        {open && (
          <div className="modal-body">
            <div className="modal-head">
              <h2>{title}</h2>
              <button type="button" className="modal-close" aria-label={t('Close')} onClick={close}>×</button>
            </div>
            {children(close)}
          </div>
        )}
      </dialog>
    </>
  );
}

export function NewWorkspaceButton({ autoOpen = false }: { autoOpen?: boolean }) {
  const t = useT();
  return (
    <ModalButton label={t('New workspace')} title={t('New workspace')} autoOpen={autoOpen}>
      {(close) => <NewWorkspaceForm onCancel={close} />}
    </ModalButton>
  );
}

function NewWorkspaceForm({ onCancel }: { onCancel: () => void }) {
  const [state, action] = useFormState<FormState, FormData>(createWorkspace, null);
  const t = useT();
  return (
    <form action={action} className="settings-form">
      <label className="field"><span>{t('Name')}</span><input name="name" maxLength={80} required autoFocus autoComplete="off" /></label>
      <Msg state={state} />
      <div className="modal-actions"><button type="button" className="btn" onClick={onCancel}>{t('Cancel')}</button><Submit label={t('Create')} busy={t('Creating…')} /></div>
    </form>
  );
}

/** Workspace page → Delete workspace: type its name to confirm. */
export function DeleteWorkspace({ id, name, blocked }: { id: string; name: string; blocked: string | null }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useT();
  if (blocked) return <p className="field-hint">{blocked}</p>;
  return (
    <form className="settings-form" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await deleteWorkspace(id); if (r?.error) setError(r.error); }); }}>
      <p className="field-hint">{t('Deletes its scopes, their documents and evaluations. Members lose access.')}</p>
      <label className="field"><span>{t('Type {name} to confirm', { name: '\u0000' }).split('\u0000').map((part, i) => i === 0 ? part : <span key={i}><strong>{name}</strong>{part}</span>)}</span><input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" /></label>
      {error && <p className="form-msg err">{error}</p>}
      <div className="settings-actions"><button type="submit" className="btn danger" disabled={pending || value.trim() !== name}>{pending ? t('Deleting…') : t('Delete workspace')}</button></div>
    </form>
  );
}

/* ---------------- Members ---------------- */

export function AddMemberButton({ workspaceId }: { workspaceId: string }) {
  const t = useT();
  return (
    <ModalButton label={t('Add member')} title={t('Add member')}>
      {(close) => <InviteForm workspaceId={workspaceId} onDone={close} />}
    </ModalButton>
  );
}

function InviteForm({ workspaceId, onDone }: { workspaceId: string; onDone: () => void }) {
  const [state, action] = useFormState<FormState, FormData>(inviteMember, null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const t = useT();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  if (state?.link) {
    return (
      <div className="settings-form">
        <p className="field-hint">{t('Send this link — it works for 14 days.')}</p>
        <div className="invite-link">
          <code>{state.link}</code>
          <button type="button" className="btn" onClick={async () => { await navigator.clipboard.writeText(state.link!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? t('Copied') : t('Copy')}
          </button>
        </div>
        <div className="modal-actions"><button type="button" className="btn primary" onClick={onDone}>{t('Done')}</button></div>
      </div>
    );
  }
  return (
    <form action={action} className="settings-form">
      <input type="hidden" name="workspace" value={workspaceId} />
      <label className="field"><span>{t('Email')}</span><input name="email" type="email" required autoFocus autoComplete="off" /></label>
      <label className="field"><span>{t('Role')}</span>
        <select name="role" defaultValue="member">
          <option value="member">{t('Member — sees results')}</option>
          <option value="admin">{t('Admin — configures')}</option>
        </select>
      </label>
      {state && !state.ok && <Msg state={state} />}
      <div className="modal-actions"><button type="button" className="btn" onClick={onDone}>{t('Cancel')}</button><Submit label={t('Create invite')} busy={t('Creating…')} /></div>
    </form>
  );
}

export function MemberRow({ workspaceId, member, canManage, isSelf, isOwner }: {
  workspaceId: string; member: { userId: string; username: string; displayName: string; avatarUrl: string | null; role: string };
  canManage: boolean; isSelf: boolean; isOwner: boolean;
}) {
  const [role, setRole] = useState(member.role);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();
  return (
    <li className="member-row">
      <UserAvatar name={member.username} src={member.avatarUrl} size={34} />
      <span className="member-who"><strong>{member.displayName}{isSelf ? ` ${t('(you)')}` : ''}</strong><em>u/{member.username}{isOwner ? ` · ${t('owner')}` : ''}</em></span>
      {canManage && !isOwner ? (
        <select value={role} disabled={pending} aria-label={t('Role of {username}', { username: member.username })} onChange={(e) => {
          const v = e.target.value as 'admin' | 'member'; const prev = role; setRole(v); setError(null);
          start(async () => { const r = await setMemberRole(workspaceId, member.userId, v); if (r.error) { setRole(prev); setError(r.error); } else router.refresh(); });
        }}>
          <option value="admin">{t('Admin')}</option><option value="member">{t('Member')}</option>
        </select>
      ) : <span className="member-role">{role === 'admin' ? t('Admin') : t('Member')}</span>}
      {!isOwner && (canManage || isSelf) && (
        <button type="button" className="btn" disabled={pending} onClick={() => {
          if (!confirm(isSelf ? t('Leave this workspace?') : t('Remove u/{username} from this workspace?', { username: member.username }))) return;
          start(async () => { const r = await removeMember(workspaceId, member.userId); if (r?.error) setError(r.error); else router.refresh(); });
        }}>{isSelf ? t('Leave') : t('Remove')}</button>
      )}
      {error && <p className="form-msg err member-error">{error}</p>}
    </li>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useT();
  return <button type="button" className="btn" disabled={pending} onClick={() => start(async () => { await revokeInvite(id); router.refresh(); })}>{t('Revoke')}</button>;
}
