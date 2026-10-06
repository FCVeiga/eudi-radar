'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import {
  FormState, adminSetPlan, createTeam, createWorkspace, deleteWorkspace, inviteMember, openBillingPortal, removeMember,
  renameWorkspace, revokeInvite, setMemberRole, startCheckout, switchWorkspace,
} from '@/app/settings/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
}
const Msg = ({ state }: { state: FormState }) => state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p>;

/* ---------------- Billing ---------------- */

export function PlanButton({ accountId, plan, label, primary }: { accountId: string; plan: string; label: string; primary?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={`btn ${primary ? 'primary' : ''}`} disabled={pending}
        onClick={() => start(async () => { const r = await startCheckout(accountId, plan); if (r?.error) setError(r.error); })}>
        {pending ? 'Opening checkout…' : label}
      </button>
      {error && <p className="form-msg err">{error}</p>}
    </>
  );
}

export function PortalButton({ accountId }: { accountId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn" disabled={pending} onClick={() => start(async () => { const r = await openBillingPortal(accountId); if (r?.error) setError(r.error); })}>
        {pending ? 'Opening…' : 'Manage billing'}
      </button>
      {error && <p className="form-msg err">{error}</p>}
    </>
  );
}

/** Platform admins: assign a plan by hand. */
export function AdminPlanSelect({ accountId, plan, options }: { accountId: string; plan: string; options: { key: string; name: string }[] }) {
  const [value, setValue] = useState(plan);
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <label className="filter-select admin-plan">
      <span>Admin · set plan</span>
      <select value={value} onChange={(e) => { const v = e.target.value; setValue(v); start(async () => { await adminSetPlan(accountId, v); router.refresh(); }); }}>
        {options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
      </select>
    </label>
  );
}

/* ---------------- Team ---------------- */

export function CreateTeamForm() {
  const [state, action] = useFormState<FormState, FormData>(createTeam, null);
  return (
    <form action={action} className="inline-form">
      <input name="name" placeholder="Team name, e.g. Acme Consulting" maxLength={80} required aria-label="Team name" />
      <Submit label="Create team" busy="Creating…" />
      <Msg state={state} />
    </form>
  );
}

export function InviteForm({ accountId }: { accountId: string }) {
  const [state, action] = useFormState<FormState, FormData>(inviteMember, null);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="settings-form invite-form">
      <input type="hidden" name="account" value={accountId} />
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

export function MemberRow({ accountId, member, canManage, isSelf }: {
  accountId: string; member: { userId: string; username: string; displayName: string; avatarUrl: string | null; role: string };
  canManage: boolean; isSelf: boolean;
}) {
  const [role, setRole] = useState(member.role);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <li className="member-row">
      <UserAvatar name={member.username} src={member.avatarUrl} size={34} />
      <span className="member-who"><strong>{member.displayName}{isSelf ? ' (you)' : ''}</strong><em>u/{member.username}</em></span>
      {canManage ? (
        <select value={role} disabled={pending} aria-label={`Role of ${member.username}`} onChange={(e) => {
          const v = e.target.value as 'admin' | 'member'; const prev = role; setRole(v); setError(null);
          start(async () => { const r = await setMemberRole(accountId, member.userId, v); if (r.error) { setRole(prev); setError(r.error); } else router.refresh(); });
        }}>
          <option value="admin">Admin</option><option value="member">Member</option>
        </select>
      ) : <span className="member-role">{role === 'admin' ? 'Admin' : 'Member'}</span>}
      {(canManage || isSelf) && (
        <button type="button" className="btn" disabled={pending} onClick={() => {
          if (!confirm(isSelf ? 'Leave this team?' : `Remove u/${member.username} from the team?`)) return;
          start(async () => { const r = await removeMember(accountId, member.userId); if (r?.error) setError(r.error); else router.refresh(); });
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

/* ---------------- Workspaces ---------------- */

export function WorkspaceRow({ ws, current, canManage }: { ws: { id: string; name: string }; current: boolean; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ws.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <li className={`ws-row ${current ? 'current' : ''}`}>
      {editing ? (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); start(async () => { await renameWorkspace(ws.id, name); setEditing(false); router.refresh(); }); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus aria-label="Workspace name" />
          <button type="submit" className="btn primary" disabled={pending}>Save</button>
          <button type="button" className="btn" onClick={() => { setEditing(false); setName(ws.name); }}>Cancel</button>
        </form>
      ) : (
        <>
          <span className="ws-name">{ws.name}{current && <span className="scope-badge">Current</span>}</span>
          {!current && <form action={switchWorkspace.bind(null, ws.id, '/')}><button type="submit" className="btn">Open</button></form>}
          {canManage && <button type="button" className="btn" onClick={() => setEditing(true)}>Rename</button>}
          {canManage && (
            <button type="button" className="btn" disabled={pending} onClick={() => {
              if (!confirm(`Delete the workspace “${ws.name}” and its scopes?`)) return;
              start(async () => { const r = await deleteWorkspace(ws.id); if (r.error) setError(r.error); else router.refresh(); });
            }}>Delete</button>
          )}
        </>
      )}
      {error && <p className="form-msg err member-error">{error}</p>}
    </li>
  );
}

export function CreateWorkspaceForm({ accountId }: { accountId: string }) {
  const [state, action] = useFormState<FormState, FormData>(createWorkspace, null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="account" value={accountId} />
      <input name="name" placeholder="New workspace, e.g. Public sector — Iberia" maxLength={80} required aria-label="Workspace name" />
      <Submit label="Add workspace" busy="Adding…" />
      <Msg state={state} />
    </form>
  );
}
