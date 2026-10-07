import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authClient, getCurrentUser } from '@/lib/auth';
import { getPersonalAccount, isPlatformAdmin } from '@/lib/accounts';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { billingReady, stripe } from '@/lib/billing';
import { getPlatformLanguage } from '@/lib/language';
import { SITE_LANGUAGES } from '@/lib/siteLanguages';
import { NotificationSettings } from '@/components/social/NotificationsPage';
import { DeleteAccountForm } from '@/components/auth/ProfileForms';
import {
  ChatPermission, EmailForm, LogOutEverywhere, PasswordForm, PlanButton, PortalButton, SetPlan, SiteLanguage,
} from '@/components/settings/SettingsControls';

export const metadata = { title: 'Settings — EUDI Radar' };
const fmt = (d: string | number | Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const money = (cents: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

/** Settings: account, plan & billing, notifications, chat, language, your data. */
export default async function SettingsPage({ searchParams }: { searchParams: { billing?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings');
  const [{ data: { user: auth } }, account, admin, language, { data: profile }] = await Promise.all([
    authClient().auth.getUser(),
    getPersonalAccount(user.id),
    isPlatformAdmin(),
    getPlatformLanguage(),
    getSupabaseServerClient().from('profiles').select('notification_prefs, chat_permission').eq('id', user.id).maybeSingle(),
  ]);
  const hasPassword = (auth?.identities || []).some((i: any) => i.provider === 'email');
  const providers = Array.from(new Set((auth?.identities || []).map((i: any) => i.provider))).filter((p) => p !== 'email');
  const plan = account?.plan ?? PLANS[0];

  // Invoices from Stripe, when billing is set up and you've paid before.
  let invoices: { id: string; number: string | null; date: number; amount: number; currency: string; status: string | null; url: string | null; pdf: string | null }[] = [];
  let invoiceError = false;
  const s = stripe();
  if (s && account?.stripeCustomerId) {
    try {
      const list = await s.invoices.list({ customer: account.stripeCustomerId, limit: 24 });
      invoices = list.data.map((i) => ({ id: i.id!, number: i.number, date: i.created * 1000, amount: i.total, currency: i.currency, status: i.status, url: i.hosted_invoice_url ?? null, pdf: i.invoice_pdf ?? null }));
    } catch { invoiceError = true; }
  }

  return (
    <div className="settings">
      <h1 className="opps-h1">Settings</h1>
      <nav className="settings-nav" aria-label="Settings sections">
        <a href="#account">Account</a><a href="#billing">Plan &amp; billing</a><a href="#notifications">Notifications</a>
        <a href="#chat">Chat</a><a href="#language">Language</a><a href="#data">Your data</a>
      </nav>

      {/* ---------- Account ---------- */}
      <section className="detail-block" id="account">
        <h2>Account</h2>
        <p className="settings-intro">
          Signed in as <strong>{user.email}</strong>{providers.length ? ` (also with ${providers.map((p) => p[0].toUpperCase() + p.slice(1)).join(', ')})` : ''} ·
          member since {fmt(user.createdAt)}. Your name, picture and bio are on <Link href="/profile/edit">Edit profile</Link>.
        </p>
        <h3 className="form-subhead">Email</h3>
        <EmailForm email={user.email} needsPassword={hasPassword} />
        <h3 className="form-subhead">{hasPassword ? 'Password' : 'Set a password'}</h3>
        {!hasPassword && <p className="field-hint">You sign in with {providers.join(', ') || 'a provider'}. Set a password to also log in with your email.</p>}
        <PasswordForm hasPassword={hasPassword} />
        <h3 className="form-subhead">Sessions</h3>
        <p className="field-hint">Lost a device or used a shared computer? End every session, including this one.</p>
        <LogOutEverywhere />
      </section>

      {/* ---------- Plan & billing ---------- */}
      <section className="detail-block" id="billing">
        <h2>Plan &amp; billing</h2>
        {searchParams.billing === 'success' && <p className="form-msg ok">Thanks — your plan is being activated. It can take a few seconds to show here.</p>}
        <p className="settings-intro">
          You’re on the <strong>{plan.name}</strong> plan
          {account?.planStatus === 'comped' ? ' (complimentary)' : account && account.planStatus !== 'active' ? ` (${account.planStatus.replace('_', ' ')})` : ''}
          {account?.periodEnd ? ` · renews ${fmt(account.periodEnd)}` : ''}. It applies to the <Link href="/workspace">workspaces</Link> you own.
          {!billingReady() && ' Online payments aren’t switched on yet — contact us to change plans.'}
        </p>
        <div className="plan-grid">
          {PLANS.map((p) => {
            const current = plan.key === p.key;
            return (
              <div key={p.key} className={`plan-card ${current ? 'current' : ''}`}>
                <div className="plan-head"><h3>{p.name}</h3>{current && <span className="scope-badge">Current</span>}</div>
                <p className="plan-price">€{p.priceEur}<span>/month</span></p>
                <p className="plan-blurb">{p.blurb}</p>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                {!current && p.key !== 'free' && <PlanButton plan={p.key} label={`${p.priceEur > plan.priceEur ? 'Upgrade to' : 'Switch to'} ${p.name}`} />}
              </div>
            );
          })}
        </div>
        <div className="billing-actions">
          {account?.stripeCustomerId && <PortalButton label="Payment method, cancel or downgrade" />}
          {admin && <SetPlan userId={user.id} plan={plan.key} options={PLANS.map((p) => ({ key: p.key, name: p.name }))} />}
        </div>
        <h3 className="form-subhead">Invoices</h3>
        {invoiceError ? <p className="form-msg err">Couldn’t load invoices from Stripe right now.</p>
          : invoices.length === 0 ? <p className="field-hint">No invoices yet — they appear here after your first payment.</p> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Invoice</th><th>Status</th><th className="num">Amount</th><th /></tr></thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td>{fmt(i.date)}</td><td>{i.number ?? '—'}</td><td>{i.status ? i.status[0].toUpperCase() + i.status.slice(1) : '—'}</td>
                      <td className="num">{money(i.amount, i.currency)}</td>
                      <td className="num">{i.pdf ? <a href={i.pdf} target="_blank" rel="noopener noreferrer">PDF</a> : i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer">View</a> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {/* ---------- Notifications ---------- */}
      <section className="detail-block" id="notifications">
        <h2>Notifications</h2>
        <p className="settings-intro">What shows up under the bell. Saved as you switch.</p>
        <NotificationSettings prefs={profile?.notification_prefs || {}} />
      </section>

      {/* ---------- Chat ---------- */}
      <section className="detail-block" id="chat">
        <h2>Chat</h2>
        <ChatPermission value={profile?.chat_permission ?? 'everyone'} />
      </section>

      {/* ---------- Language ---------- */}
      <section className="detail-block" id="language">
        <h2>Language</h2>
        <p className="settings-intro">
          The site is in <strong>{language.name}</strong>. Tenders, documents and news from every country are translated into it by the
          Translator Agent, so everyone reads the same text.
        </p>
        {admin && <SiteLanguage code={language.code} options={SITE_LANGUAGES} />}
      </section>

      {/* ---------- Your data ---------- */}
      <section className="detail-block" id="data">
        <h2>Your data</h2>
        <p className="settings-intro">Download everything you’ve added — profile, posts, comments, likes, people you follow, messages you sent and your workspaces — as a JSON file.</p>
        <a href="/settings/export" className="btn" download>Download your data</a>
      </section>

      <section className="detail-block danger-zone" id="delete">
        <h2>Delete account</h2>
        <p className="field-hint">Workspaces you own are deleted too, for everyone in them. To keep one for your team, have its members export what they need first.</p>
        <DeleteAccountForm username={user.username} />
      </section>
    </div>
  );
}
