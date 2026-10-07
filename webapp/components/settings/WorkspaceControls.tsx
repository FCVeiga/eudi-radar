'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import {
  FormState, createWorkspace, deleteWorkspace, inviteMember, removeMember, renameWorkspace, revokeInvite, setMemberRole,
} from '@/app/workspace/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
}
const Msg = ({ state }: { state: FormState }) => state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p>;

/* ---------------- Workspace ---------------- */

export function WorkspaceName({ id, name, canRename, canDelete }: { id: string; name: string; canRename: boolean; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (editing) {
    return (
      <form className="inline-form ws-rename" onSubmit={(e) => { e.preventDefault(); start(async () => { await renameWorkspace(id, value); setEditing(false); router.refresh(); }); }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} autoFocus aria-label="Workspace name" />
        <button type="submit" className="btn primary" disabled={pending}>Save</button>
        <button type="button" className="btn" onClick={() => { setEditing(false); setValue(name); }}>Cancel</button>
      </form>
    );
  }
  return (
    <div className="ws-title">
      <h1 className="opps-h1">{name}</h1>
      {canRename && <button type="button" className="section-edit" aria-label="Rename workspace" onClick={() => setEditing(true)}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.7a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5 2.5 13.5l1-3.1z" /></svg></button>}
      {canDelete && <button type="button" className="btn ws-delete" disabled={pending} onClick={() => {
        if (!confirm(`Delete the workspace “${name}” with its scopes? Members lose access.`)) return;
        start(async () => { const r = await deleteWorkspace(id); if (r?.error) setError(r.error); });
      }}>Delete workspace</button>}
      {error && <p className="form-msg err">{error}</p>}
    </div>
  );
}

export function NewWorkspaceForm() {
  const [state, action] = useFormState<FormState, FormData>(createWorkspace, null);
  return (
    <form action={action} className="inline-form">
      <input name="name" placeholder="New workspace, e.g. Public sector — Iberia" maxLength={80} required aria-label="New workspace name" />
      <Submit label="Create workspace" busy="Creating…" />
      <Msg state={state} />
    </form>
  );
}

/* ---------------- Members ---------------- */

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useFormState<FormState, FormData>(inviteMember, null);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="settings-form invite-form">
      <input type="hidden" name="workspace" value={workspaceId} />
      <div className="inline-form">
        <input name="email" type="email" placeholder="Email (optional — limits the link to that person)" aria-label="Email" />
        <select name="role" defaultValue="member" aria-label="Role">
          <option value="member">Member — sees results</option>
          <option value="admin">Admin — configures</option>
        </select>
        <Submit label="Create invite link" busy="Creating…" />
      </div>
      <Msg state={state} />
      {state?.link && (
        <div className="invite-link">
          <code>{state.link}</code>
          <button type="button" className="btn" onClick={async () => { await navigator.clipboard.writeText(state.link!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
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
  return (
    <li className="member-row">
      <UserAvatar name={member.username} src={member.avatarUrl} size={34} />
      <span className="member-who"><strong>{member.displayName}{isSelf ? ' (you)' : ''}</strong><em>u/{member.username}{isOwner ? ' · owner' : ''}</em></span>
      {canManage && !isOwner ? (
        <select value={role} disabled={pending} aria-label={`Role of ${member.username}`} onChange={(e) => {
          const v = e.target.value as 'admin' | 'member'; const prev = role; setRole(v); setError(null);
          start(async () => { const r = await setMemberRole(workspaceId, member.userId, v); if (r.error) { setRole(prev); setError(r.error); } else router.refresh(); });
        }}>
          <option value="admin">Admin</option><option value="member">Member</option>
        </select>
      ) : <span className="member-role">{role === 'admin' ? 'Admin' : 'Member'}</span>}
      {!isOwner && (canManage || isSelf) && (
        <button type="button" className="btn" disabled={pending} onClick={() => {
          if (!confirm(isSelf ? 'Leave this workspace?' : `Remove u/${member.username} from this workspace?`)) return;
          start(async () => { const r = await removeMember(workspaceId, member.userId); if (r?.error) setError(r.error); else router.refresh(); });
        }}>{isSelf ? 'Leave' : 'Remove'}</button>
      )}
      {error && <p className="form-msg err member-error">{error}</p>}
    </li>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button type="button" className="btn" disabled={pending} onClick={() => start(async () => { await revokeInvite(id); router.refresh(); })}>Revoke</button>;
}
