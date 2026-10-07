'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase';
import { authClient, getCurrentUser, siteOrigin } from '@/lib/auth';
import { getPersonalAccount, isPlatformAdmin } from '@/lib/accounts';
import { PLANS, planOf } from '@/lib/plans';
import { PRICE_ENV, billingReady, stripe } from '@/lib/billing';
import { TARGET_LINE } from '@/lib/language';
import { SITE_LANGUAGES } from '@/lib/siteLanguages';

export type SettingsState = { ok: boolean; message: string } | null;
const db = () => getSupabaseServerClient();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The signed-in auth user (with identities), or null. */
async function authUser() {
  const { data: { user } } = await authClient().auth.getUser();
  return user;
}
const hasPassword = (u: any) => (u?.identities || []).some((i: any) => i.provider === 'email');

/** Checks a password without touching the browser's session (a throwaway client). */
async function passwordOk(email: string, password: string) {
  const c = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (data.session) await c.auth.admin.signOut(data.session.access_token).catch(() => {});
  return !error;
}

/* ---------------- Account ---------------- */

export async function changeEmail(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await authUser();
  if (!user?.email) return { ok: false, message: 'Your session expired — log in again.' };
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  if (email === user.email.toLowerCase()) return { ok: false, message: 'That’s already your email.' };
  if (hasPassword(user) && !(await passwordOk(user.email, String(form.get('password') || '')))) return { ok: false, message: 'Your current password is wrong.' };
  // Applied straight away: confirmation emails need an email provider on Supabase (see Help).
  const { error } = await db().auth.admin.updateUserById(user.id, { email, email_confirm: true });
  if (error) return { ok: false, message: /already|registered|exists/i.test(error.message) ? 'Another account uses that email.' : error.message };
  revalidatePath('/settings');
  return { ok: true, message: `Your email is now ${email}. Use it to log in.` };
}

export async function changePassword(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await authUser();
  if (!user?.email) return { ok: false, message: 'Your session expired — log in again.' };
  const password = String(form.get('password') || '');
  if (password.length < 8) return { ok: false, message: 'Use a password of at least 8 characters.' };
  if (password !== String(form.get('confirm') || '')) return { ok: false, message: 'The new passwords don’t match.' };
  if (hasPassword(user) && !(await passwordOk(user.email, String(form.get('current') || '')))) return { ok: false, message: 'Your current password is wrong.' };
  const { error } = await db().auth.admin.updateUserById(user.id, { password });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: hasPassword(user) ? 'Password changed.' : 'Password set — you can now also log in with your email.' };
}

/** Signs out every browser and device, this one included. */
export async function logOutEverywhere() {
  await authClient().auth.signOut({ scope: 'global' });
  revalidatePath('/', 'layout');
  redirect('/login');
}

/* ---------------- Chat & privacy ---------------- */

export async function setChatPermission(value: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Log in first.' };
  if (!['everyone', 'workspace', 'nobody'].includes(value)) return { error: 'Unknown option.' };
  await db().from('profiles').update({ chat_permission: value }).eq('id', user.id);
  return {};
}

/* ---------------- Language ---------------- */

/** Site language: the Translator Agent's "Target language" line. Admins only. */
export async function setSiteLanguage(code: string): Promise<{ error?: string }> {
  if (!(await isPlatformAdmin())) return { error: 'Not allowed.' };
  const lang = SITE_LANGUAGES.find((l) => l.code === code);
  if (!lang) return { error: 'Unknown language.' };
  const { data } = await db().from('agent_settings').select('prompt_override, default_prompt').eq('agent_key', 'translator').maybeSingle();
  const base = data?.prompt_override || data?.default_prompt;
  if (!base || !TARGET_LINE.test(base)) return { error: 'The Translator Agent’s configuration has no “Target language” line.' };
  const line = `Target language: ${lang.name} (${lang.code})`;
  const next = base.replace(TARGET_LINE, line);
  const isDefault = data?.default_prompt && next === data.default_prompt;
  await db().from('agent_settings').update({ prompt_override: isDefault ? null : next }).eq('agent_key', 'translator');
  revalidatePath('/', 'layout');
  return {};
}

/* ---------------- Plan & billing ---------------- */

export async function startCheckout(plan: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Log in first.' };
  const account = await getPersonalAccount(user.id);
  const p = planOf(plan);
  if (!account || p.key === 'free') return { error: 'That plan isn’t available.' };
  const s = stripe();
  if (!s || !billingReady()) return { error: 'Online payments aren’t set up yet — contact us to change your plan.' };
  let customer = account.stripeCustomerId;
  if (!customer) {
    const c = await s.customers.create({ email: user.email, name: user.displayName, metadata: { account_id: account.id } });
    customer = c.id;
    await db().from('accounts').update({ stripe_customer_id: customer }).eq('id', account.id);
  }
  // Already subscribed: plan changes and cancellations go through the billing portal.
  if (account.planKey !== 'free' && account.planStatus !== 'comped' && account.planStatus !== 'canceled') {
    const portal = await s.billingPortal.sessions.create({ customer, return_url: `${siteOrigin()}/settings#billing` });
    redirect(portal.url);
  }
  const session = await s.checkout.sessions.create({
    mode: 'subscription', customer,
    line_items: [{ price: process.env[PRICE_ENV[p.key]]!, quantity: 1 }],
    success_url: `${siteOrigin()}/settings?billing=success#billing`,
    cancel_url: `${siteOrigin()}/settings#billing`,
    metadata: { account_id: account.id, plan: p.key },
    subscription_data: { metadata: { account_id: account.id, plan: p.key } },
    allow_promotion_codes: true,
  });
  redirect(session.url!);
}

export async function openBillingPortal(): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const account = user ? await getPersonalAccount(user.id) : null;
  const s = stripe();
  if (!s || !account?.stripeCustomerId) return { error: 'No billing account yet.' };
  const portal = await s.billingPortal.sessions.create({ customer: account.stripeCustomerId, return_url: `${siteOrigin()}/settings#billing` });
  redirect(portal.url);
}

/** Internal: assign a plan by hand (complimentary), e.g. before Stripe is set up. */
export async function adminSetPlan(userId: string, plan: string): Promise<{ error?: string }> {
  if (!(await isPlatformAdmin())) return { error: 'Not allowed.' };
  if (!PLANS.some((p) => p.key === plan)) return { error: 'Unknown plan.' };
  await db().from('accounts').update({ plan, plan_status: plan === 'free' ? 'active' : 'comped' }).eq('kind', 'personal').eq('owner_id', userId);
  revalidatePath('/', 'layout');
  return {};
}
