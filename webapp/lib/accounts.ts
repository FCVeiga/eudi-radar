/**
 * Accounts and workspaces (migration 026).
 *   - Everyone has a personal account (Free / Starter / Pro); team accounts
 *     run on Teams. The platform account holds the default scope.
 *   - An account owns workspaces; a workspace holds scopes.
 *   - In a team, admins create workspaces and configure scopes; members see
 *     the results. Platform admins configure the workspace agents.
 * The site shows the user's current workspace (profiles.current_workspace_id).
 */
import 'server-only';
import { cache } from 'react';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { planOf, type Plan } from '@/lib/plans';

export type Account = {
  id: string; kind: 'personal' | 'team' | 'platform'; name: string; ownerId: string | null; plan: Plan; planKey: string;
  planStatus: string; stripeCustomerId: string | null; periodEnd: string | null; role: 'admin' | 'member';
};
export type Workspace = { id: string; accountId: string; name: string; createdAt: string };
export type Context = {
  account: Account; workspace: Workspace;
  isAdmin: boolean;            // can configure this workspace's scopes
  canCustomize: boolean;       // plan allows customizing scopes (and admin)
  isPlatformAdmin: boolean;    // can configure the workspace agents
};

const db = () => getSupabaseServerClient();

const toAccount = (a: any, role: string): Account => ({
  id: a.id, kind: a.kind, name: a.name, ownerId: a.owner_id, plan: planOf(a.kind === 'platform' ? 'teams' : a.plan), planKey: a.plan,
  planStatus: a.plan_status, stripeCustomerId: a.stripe_customer_id, periodEnd: a.current_period_end, role: role as 'admin' | 'member',
});

/** Every account the user belongs to, with their role, and its workspaces. */
export const getMyAccounts = cache(async (): Promise<{ account: Account; workspaces: Workspace[] }[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data: memberships } = await db().from('account_members').select('role, accounts(*)').eq('user_id', user.id);
  const accounts = (memberships || []).filter((m: any) => m.accounts).map((m: any) => toAccount(m.accounts, m.role));
  const { data: ws } = accounts.length
    ? await db().from('workspaces').select('*').in('account_id', accounts.map((a) => a.id)).order('created_at')
    : { data: [] as any[] };
  const order = { personal: 0, team: 1, platform: 2 } as const;
  return accounts.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name)).map((account) => ({
    account,
    workspaces: (ws || []).filter((w: any) => w.account_id === account.id).map((w: any) => ({ id: w.id, accountId: w.account_id, name: w.name, createdAt: w.created_at })),
  }));
});

/** The workspace the user is in (their saved choice, else their personal one), with what they may do there. */
export const getContext = cache(async (): Promise<Context | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const all = await getMyAccounts();
  if (!all.length) return null;
  const { data: profile } = await db().from('profiles').select('current_workspace_id, is_platform_admin').eq('id', user.id).maybeSingle();
  const pick = all.flatMap((a) => a.workspaces.map((w) => ({ account: a.account, workspace: w })));
  const current = pick.find((p) => p.workspace.id === profile?.current_workspace_id)
    ?? pick.find((p) => p.account.kind === 'personal') ?? pick[0];
  if (!current) return null;
  const isPlatformAdmin = !!profile?.is_platform_admin;
  const isAdmin = current.account.role === 'admin' || (current.account.kind === 'platform' && isPlatformAdmin);
  return { ...current, isAdmin, canCustomize: isAdmin && current.account.plan.customize, isPlatformAdmin };
});

/** The account and the user's role in it (null if they aren't a member). */
export async function getAccountFor(accountId: string) {
  return (await getMyAccounts()).find((a) => a.account.id === accountId) ?? null;
}

/** May the user configure this workspace's scopes? (account admin, plan allows customizing) */
export async function canEditWorkspace(workspaceId: string) {
  const all = await getMyAccounts();
  const hit = all.find((a) => a.workspaces.some((w) => w.id === workspaceId));
  if (!hit) return null;
  const user = await getCurrentUser();
  const { data: p } = await db().from('profiles').select('is_platform_admin').eq('id', user!.id).maybeSingle();
  const admin = hit.account.role === 'admin' || (hit.account.kind === 'platform' && !!p?.is_platform_admin);
  return admin && hit.account.plan.customize ? hit.account : null;
}

export async function isPlatformAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await db().from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle();
  return !!data?.is_platform_admin;
}
