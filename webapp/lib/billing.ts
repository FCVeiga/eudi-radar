/**
 * Billing (Stripe). Ready once these are set on the server:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAMS (monthly prices).
 * Checkout starts a subscription for an account; the webhook
 * (app/api/stripe/webhook) sets the account's plan from Stripe. Until Stripe is
 * configured, platform admins assign plans by hand on Settings.
 */
import 'server-only';
import Stripe from 'stripe';

export const PRICE_ENV: Record<string, string> = { starter: 'STRIPE_PRICE_STARTER', pro: 'STRIPE_PRICE_PRO', teams: 'STRIPE_PRICE_TEAMS' };

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export const billingReady = () => !!process.env.STRIPE_SECRET_KEY && Object.values(PRICE_ENV).every((k) => !!process.env[k]);

/** Plan for a Stripe price id (the inverse of PRICE_ENV). */
export function planForPrice(priceId: string | null | undefined) {
  return Object.entries(PRICE_ENV).find(([, env]) => process.env[env] && process.env[env] === priceId)?.[0] ?? null;
}
