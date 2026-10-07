import { authClient, getCurrentUser } from '@/lib/auth';
import { getPersonalAccount, isPlatformAdmin } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { billingReady, stripe } from '@/lib/billing';
import AccountTab from '@/components/settings/tabs/AccountTab';

export default async function AccountSettings({ searchParams }: { searchParams: { plan?: string; billing?: string } }) {
  const user = (await getCurrentUser())!;
  const [{ data: { user: auth } }, account, admin, { data: profile }] = await Promise.all([
    authClient().auth.getUser(),
    getPersonalAccount(user.id),
    isPlatformAdmin(),
    getSupabaseServerClient().from('profiles').select('birthday, gender').eq('id', user.id).maybeSingle(),
  ]);
  const identities = auth?.identities || [];
  const google = identities.find((i: any) => i.provider === 'google');

  // Invoices from Stripe, when billing is set up and you've paid before.
  let invoices: { id: string; number: string | null; date: number; amount: number; currency: string; status: string | null; url: string | null }[] = [];
  const s = stripe();
  if (s && account?.stripeCustomerId) {
    try {
      const list = await s.invoices.list({ customer: account.stripeCustomerId, limit: 24 });
      invoices = list.data.map((i) => ({ id: i.id!, number: i.number, date: i.created * 1000, amount: i.total, currency: i.currency, status: i.status, url: i.invoice_pdf ?? i.hosted_invoice_url ?? null }));
    } catch { /* shown as none */ }
  }

  return (
    <AccountTab
      userId={user.id} username={user.username} email={user.email}
      hasPassword={identities.some((i: any) => i.provider === 'email')}
      google={google ? ((google.identity_data as any)?.email ?? 'connected') : null}
      birthday={profile?.birthday ?? null} gender={profile?.gender ?? null}
      plan={{ key: account?.plan.key ?? 'free', status: account?.planStatus ?? 'active', periodEnd: account?.periodEnd ?? null, hasBilling: !!account?.stripeCustomerId }}
      plans={PLANS} invoices={invoices} billingReady={billingReady()} admin={admin}
      openPlan={searchParams.plan === '1'} paid={searchParams.billing === 'success'}
    />
  );
}
