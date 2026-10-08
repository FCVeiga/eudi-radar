/**
 * Billing (Stripe Checkout subscriptions). Ready once these are set on the server:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAMS (monthly),
 *   STRIPE_PRICE_STARTER_YEAR, STRIPE_PRICE_PRO_YEAR, STRIPE_PRICE_TEAMS_YEAR
 *   (a year is eleven times the monthly price).
 * Checkout starts a subscription; the webhook (app/api/stripe/webhook) sets the
 * account's plan from the Stripe price. Until Stripe is configured, platform
 * admins assign plans by hand on Settings.
 */
import 'server-only';
import Stripe from 'stripe';

const PRICE_ENV: Record<string, { month: string; year: string }> = {
  starter: { month: 'STRIPE_PRICE_STARTER', year: 'STRIPE_PRICE_STARTER_YEAR' },
  pro: { month: 'STRIPE_PRICE_PRO', year: 'STRIPE_PRICE_PRO_YEAR' },
  teams: { month: 'STRIPE_PRICE_TEAMS', year: 'STRIPE_PRICE_TEAMS_YEAR' },
};

export type BillingInterval = 'month' | 'year';

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export function priceId(plan: string, interval: BillingInterval = 'month') {
  const env = PRICE_ENV[plan]?.[interval];
  return env ? process.env[env] : undefined;
}

/** True when Stripe is configured for one plan, or for every paid plan when called with no plan. */
export function billingReady(plan?: string, interval: BillingInterval = 'month') {
  if (!stripe()) return false;
  if (!plan) return (['starter', 'pro', 'teams'] as const).every((key) => !!priceId(key, 'month') && !!priceId(key, 'year'));
  return !!priceId(plan, interval);
}

/** Plan for a Stripe price id (monthly or yearly). */
export function planForPrice(id: string | null | undefined) {
  if (!id) return null;
  return Object.entries(PRICE_ENV).find(([, envs]) => Object.values(envs).some((env) => process.env[env] && process.env[env] === id))?.[0] ?? null;
}
