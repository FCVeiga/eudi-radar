'use server';

import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser, siteOrigin } from '@/lib/auth';
import { getAccountFor, getMyAccounts, isPlatformAdmin } from '@/lib/accounts';
import { PLANS, planOf } from '@/lib/plans';
import { PRICE_ENV, billingReady, stripe } from '@/lib/billing';

export type FormState = { ok: boolean; message: string; link?: string } | null;
const db = () => getSupabaseServerClient();
const done = () => { revalidatePath('/', 'layout'); };

/** An account the user administers (null otherwise). */
async function adminOf(accountId: string) {
  const hit = await getAccountFor(accountId);
  if (!hit) return null;
  if (hit.account.role === 'admin') return hit;
  if (hit.account.kind === 'platform' && (await isPlatformAdmin())) return hit;
  return null;
}

/* ---------------- Switching ---------------- */

/** Make a workspace the one the whole site shows (any workspace of an account the user belongs to). */
export async function switchWorkspace(workspaceId: string, next?: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const ok = (await getMyAccounts()).some((a) => a.workspaces.some((w) => w.id === workspaceId));
  if (ok) await db().from('profiles').update({ current_workspace_id: workspaceId }).eq('id', user.id);
  done();
  redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

/* ---------------- Teams and workspaces ---------------- */

/** A new team account (the creator is its admin) with a first workspace; Teams plan via billing. */
export async function createTeam(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Log in first.' };
  const name = String(form.get('name') || '').trim().slice(0, 80);
  if (name.length < 2) return { ok: false, message: 'Give the team a name.' };
  const { data: acc, error } = await db().from('accounts').insert({ kind: 'team', name, owner_id: user.id, plan: 'free' }).select('id').single();
  if (error || !acc) return { ok: false, message: error?.message || 'Could not create the team.' };
  await db().from('account_members').insert({ account_id: acc.id, user_id: user.id, role: 'admin' });
  const { data: ws } = await db().from('workspaces').insert({ account_id: acc.id, name: `${name} workspace`, created_by: user.id }).select('id').single();
  if (ws) await db().from('profiles').update({ current_workspace_id: ws.id }).eq('id', user.id);
  done();
  redirect(`/settings?account=${acc.id}#billing`);
}

export async function createWorkspace(_prev: FormState, form: FormData): Promise<FormState> {
  const accountId = String(form.get('account') || '');
  const hit = await adminOf(accountId);
  if (!hit) return { ok: false, message: 'Only the account’s admins can add workspaces.' };
  const name = String(form.get('name') || '').trim().slice(0, 80);
  if (name.length < 2) return { ok: false, message: 'Give the workspace a name.' };
  const max = hit.account.kind === 'platform' ? null : hit.account.plan.workspaces;
  if (max !== null && hit.workspaces.length >= max) return { ok: false, message: `The ${hit.account.plan.name} plan has ${max} workspace${max === 1 ? '' : 's'} — upgrade to Teams for unlimited workspaces.` };
  const user = await getCurrentUser();
  const { error } = await db().from('workspaces').insert({ account_id: accountId, name, created_by: user!.id });
  if (error) return { ok: false, message: error.message };
  done();
  return { ok: true, message: `Workspace “${name}” created.` };
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const { data: ws } = await db().from('workspaces').select('account_id').eq('id', workspaceId).maybeSingle();
  if (!ws || !(await adminOf(ws.account_id)) || name.trim().length < 2) return;
  await db().from('workspaces').update({ name: name.trim().slice(0, 80) }).eq('id', workspaceId);
  done();
}

export async function deleteWorkspace(workspaceId: string): Promise<{ error?: string }> {
  const { data: ws } = await db().from('workspaces').select('account_id').eq('id', workspaceId).maybeSingle();
  const hit = ws && await adminOf(ws.account_id);
  if (!hit) return { error: 'Only the account’s admins can delete workspaces.' };
  if (hit.workspaces.length <= 1) return { error: 'An account keeps at least one workspace.' };
  if (await db().from('scopes').select('id').eq('workspace_id', workspaceId).eq('is_default', true).maybeSingle().then((r) => r.data)) {
    return { error: 'This workspace holds the platform’s default scope.' };
  }
  await db().from('workspaces').delete().eq('id', workspaceId);
  done();
  return {};
}

/* ---------------- Members and invitations ---------------- */

/** An invitation link to join a team (as admin or member). Teams plan only. */
export async function inviteMember(_prev: FormState, form: FormData): Promise<FormState> {
  const accountId = String(form.get('account') || '');
  const hit = await adminOf(accountId);
  if (!hit) return { ok: false, message: 'Only the team’s admins can invite people.' };
  if (hit.account.kind === 'personal') return { ok: false, message: 'Personal accounts have one user — create a team to work with others.' };
  if (hit.account.kind !== 'platform' && hit.account.plan.members !== null) return { ok: false, message: 'Inviting people needs the Teams plan.' };
  const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 200) || null;
  const role = form.get('role') === 'admin' ? 'admin' : 'member';
  const user = await getCurrentUser();
  const token = randomBytes(24).toString('base64url');
  const { error } = await db().from('account_invites').insert({ account_id: accountId, email, role, token, invited_by: user!.id });
  if (error) return { ok: false, message: error.message };
  revalidatePath('/settings');
  return { ok: true, message: 'Invitation ready — copy the link and send it. It works for 14 days.', link: `${siteOrigin()}/invite/${token}` };
}

export async function revokeInvite(inviteId: string) {
  const { data: inv } = await db().from('account_invites').select('account_id').eq('id', inviteId).maybeSingle();
  if (!inv || !(await adminOf(inv.account_id))) return;
  await db().from('account_invites').delete().eq('id', inviteId);
  revalidatePath('/settings');
}

async function adminCount(accountId: string) {
  const { count } = await db().from('account_members').select('user_id', { count: 'exact', head: true }).eq('account_id', accountId).eq('role', 'admin');
  return count ?? 0;
}

export async function setMemberRole(accountId: string, userId: string, role: 'admin' | 'member'): Promise<{ error?: string }> {
  if (!(await adminOf(accountId))) return { error: 'Only admins can change roles.' };
  if (role === 'member' && (await adminCount(accountId)) <= 1) {
    const { data } = await db().from('account_members').select('role').match({ account_id: accountId, user_id: userId }).maybeSingle();
    if (data?.role === 'admin') return { error: 'A team needs at least one admin.' };
  }
  await db().from('account_members').update({ role }).match({ account_id: accountId, user_id: userId });
  revalidatePath('/settings');
  return {};
}

/** Remove someone from a team (admins), or leave it yourself. */
export async function removeMember(accountId: string, userId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Log in first.' };
  const self = userId === user.id;
  const hit = await getAccountFor(accountId);
  if (!hit || hit.account.kind === 'personal') return { error: 'Not allowed.' };
  if (!self && !(await adminOf(accountId))) return { error: 'Only admins can remove people.' };
  const { data: target } = await db().from('account_members').select('role').match({ account_id: accountId, user_id: userId }).maybeSingle();
  if (target?.role === 'admin' && (await adminCount(accountId)) <= 1) return { error: 'A team needs at least one admin — make someone else admin first.' };
  await db().from('account_members').delete().match({ account_id: accountId, user_id: userId });
  // Anyone sitting in one of this account's workspaces moves back to their own.
  const ids = hit.workspaces.map((w) => w.id);
  if (ids.length) await db().from('profiles').update({ current_workspace_id: null }).eq('id', userId).in('current_workspace_id', ids);
  done();
  if (self) redirect('/settings');
  return {};
}

/** /invite/[token]: join the team. */
export async function acceptInvite(token: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/invite/${encodeURIComponent(token)}`);
  const { data: inv } = await db().from('account_invites').select('*').eq('token', token).maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) return { error: 'This invitation has expired or was already used.' };
  if (inv.email && inv.email !== user.email.toLowerCase()) return { error: `This invitation is for ${inv.email}. Log in with that account.` };
  await db().from('account_members').upsert({ account_id: inv.account_id, user_id: user.id, role: inv.role }, { onConflict: 'account_id,user_id' });
  await db().from('account_invites').update({ accepted_by: user.id, accepted_at: new Date().toISOString() }).eq('id', inv.id);
  const { data: ws } = await db().from('workspaces').select('id').eq('account_id', inv.account_id).order('created_at').limit(1).maybeSingle();
  if (ws) await db().from('profiles').update({ current_workspace_id: ws.id }).eq('id', user.id);
  done();
  redirect('/');
}

/* ---------------- Billing ---------------- */

/** Stripe Checkout for a plan (personal: Starter / Pro; teams: Teams). */
export async function startCheckout(accountId: string, plan: string): Promise<{ error?: string }> {
  const hit = await adminOf(accountId);
  if (!hit) return { error: 'Only the account’s admins manage billing.' };
  const p = planOf(plan);
  if (p.key === 'free' || (p.kind === 'team') !== (hit.account.kind === 'team')) return { error: 'That plan isn’t available for this account.' };
  const s = stripe();
  if (!s || !billingReady()) return { error: 'Payments aren’t set up yet — ask the platform team to switch your plan.' };
  const user = await getCurrentUser();
  let customer = hit.account.stripeCustomerId;
  if (!customer) {
    const c = await s.customers.create({ email: user!.email, name: hit.account.name, metadata: { account_id: accountId } });
    customer = c.id;
    await db().from('accounts').update({ stripe_customer_id: customer }).eq('id', accountId);
  }
  const session = await s.checkout.sessions.create({
    mode: 'subscription', customer,
    line_items: [{ price: process.env[PRICE_ENV[p.key]]!, quantity: 1 }],
    success_url: `${siteOrigin()}/settings?account=${accountId}&billing=success#billing`,
    cancel_url: `${siteOrigin()}/settings?account=${accountId}#billing`,
    metadata: { account_id: accountId, plan: p.key },
    subscription_data: { metadata: { account_id: accountId, plan: p.key } },
    allow_promotion_codes: true,
  });
  redirect(session.url!);
}

/** Stripe's customer portal: change or cancel the plan, invoices, payment method. */
export async function openBillingPortal(accountId: string): Promise<{ error?: string }> {
  const hit = await adminOf(accountId);
  if (!hit) return { error: 'Only the account’s admins manage billing.' };
  const s = stripe();
  if (!s || !hit.account.stripeCustomerId) return { error: 'No billing account yet.' };
  const portal = await s.billingPortal.sessions.create({ customer: hit.account.stripeCustomerId, return_url: `${siteOrigin()}/settings?account=${accountId}#billing` });
  redirect(portal.url);
}

/** Platform admins: assign a plan by hand (complimentary), e.g. before Stripe is set up. */
export async function adminSetPlan(accountId: string, plan: string): Promise<{ error?: string }> {
  if (!(await isPlatformAdmin())) return { error: 'Platform admins only.' };
  if (!PLANS.some((p) => p.key === plan)) return { error: 'Unknown plan.' };
  await db().from('accounts').update({ plan, plan_status: plan === 'free' ? 'active' : 'comped' }).eq('id', accountId);
  done();
  return {};
}
