/**
 * Accounts and workspaces (migrations 026–027).
 *   - Everyone has a personal account; it carries their plan.
 *   - Workspaces belong to a user (their owner). A workspace holds scopes; its
 *     owner's plan sets its limits (scopes, updates a day, members).
 *   - On Teams, the owner adds members to a workspace: admins configure its
 *     scopes, members see the results.
 * The site shows the user's current workspace (profiles.current_workspace_id).
 */
import 'server-only';
import { cache } from 'react';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { planOf, type Plan } from '@/lib/plans';

export type Workspace = { id: string; name: string; ownerId: string; createdAt: string };
export type PersonalAccount = {
  id: string; plan: Plan; planKey: string; planStatus: string; stripeCustomerId: string | null; periodEnd: string | null;
};
export type MyWorkspace = {
  workspace: Workspace; role: 'admin' | 'member'; owner: { id: string; username: string }; plan: Plan; isDefault: boolean;
};
export type Context = MyWorkspace & {
  isOwner: boolean;
  isAdmin: boolean;            // configures this workspace's scopes
  canCustomize: boolean;       // admin, and the owner's plan allows customizing
  canAddMembers: boolean;      // owner or admin, and the owner is on Teams
  isPlatformAdmin: boolean;    // internal: configures the workspace agents and the default scope
};

const db = () => getSupabaseServerClient();

const toPersonal = (a: any): PersonalAccount => ({
  id: a.id, plan: planOf(a.plan), planKey: a.plan, planStatus: a.plan_status, stripeCustomerId: a.stripe_customer_id, periodEnd: a.current_period_end,
});

export async function getPersonalAccount(userId: string): Promise<PersonalAccount | null> {
  const { data } = await db().from('accounts').select('*').eq('kind', 'personal').eq('owner_id', userId).maybeSingle();
  return data ? toPersonal(data) : null;
}

export const isPlatformAdmin = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await db().from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle();
  return !!data?.is_platform_admin;
});

/** Every workspace the user is in (owned or as a member), with their role and the owner's plan. */
export const getMyWorkspaces = cache(async (): Promise<MyWorkspace[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data: rows } = await db().from('workspace_members').select('role, workspaces(id, name, owner_id, created_at)').eq('user_id', user.id);
  const list = (rows || []).filter((r: any) => r.workspaces);
  if (!list.length) return [];
  const ownerIds = Array.from(new Set(list.map((r: any) => r.workspaces.owner_id)));
  const wsIds = list.map((r: any) => r.workspaces.id);
  const [{ data: owners }, { data: plans }, { data: defaults }] = await Promise.all([
    db().from('profiles').select('id, username').in('id', ownerIds),
    db().from('accounts').select('owner_id, plan').eq('kind', 'personal').in('owner_id', ownerIds),
    db().from('scopes').select('workspace_id').eq('is_default', true).in('workspace_id', wsIds),
  ]);
  return list.map((r: any): MyWorkspace => {
    const w = r.workspaces;
    return {
      workspace: { id: w.id, name: w.name, ownerId: w.owner_id, createdAt: w.created_at },
      role: r.role, owner: { id: w.owner_id, username: (owners || []).find((o: any) => o.id === w.owner_id)?.username ?? 'user' },
      plan: planOf((plans || []).find((p: any) => p.owner_id === w.owner_id)?.plan),
      isDefault: (defaults || []).some((d: any) => d.workspace_id === w.id),
    };
  }).sort((a, b) => Number(b.workspace.ownerId === user.id) - Number(a.workspace.ownerId === user.id) || a.workspace.createdAt.localeCompare(b.workspace.createdAt));
});

/** What the user may do in one of their workspaces. */
async function contextFor(m: MyWorkspace, userId: string): Promise<Context> {
  const platform = await isPlatformAdmin();
  const isAdmin = m.role === 'admin';
  // The default scope's workspace is edited by the platform's admins, whatever their plan.
  const canCustomize = isAdmin && (m.plan.customize || (m.isDefault && platform));
  return { ...m, isOwner: m.workspace.ownerId === userId, isAdmin, canCustomize, canAddMembers: isAdmin && m.plan.key === 'teams', isPlatformAdmin: platform };
}

/** The workspace the user is in (their saved choice, else their own first one), with what they may do there. */
export const getContext = cache(async (): Promise<Context | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const mine = await getMyWorkspaces();
  if (!mine.length) return null;
  const { data: profile } = await db().from('profiles').select('current_workspace_id').eq('id', user.id).maybeSingle();
  const current = mine.find((m) => m.workspace.id === profile?.current_workspace_id) ?? mine.find((m) => m.workspace.ownerId === user.id) ?? mine[0];
  return contextFor(current, user.id);
});

/** A given workspace of the user's (null if they aren't in it), with what they may do there. */
export async function getWorkspaceContext(workspaceId: string): Promise<Context | null> {
  const user = await getCurrentUser();
  const m = user ? (await getMyWorkspaces()).find((x) => x.workspace.id === workspaceId) : null;
  return user && m ? contextFor(m, user.id) : null;
}

/** The user's membership of a workspace (null if they aren't in it). */
export async function getMembership(workspaceId: string) {
  return (await getMyWorkspaces()).find((m) => m.workspace.id === workspaceId) ?? null;
}

/** May the user configure this workspace's scopes? Returns the membership, else null. */
export async function canEditWorkspace(workspaceId: string) {
  const m = await getMembership(workspaceId);
  if (!m || m.role !== 'admin') return null;
  return m.plan.customize || (m.isDefault && (await isPlatformAdmin())) ? m : null;
}
