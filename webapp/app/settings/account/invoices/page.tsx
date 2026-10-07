import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getPersonalAccount } from '@/lib/accounts';
import { stripe } from '@/lib/billing';
import { getLocale, getT } from '@/lib/i18n/server';

/** Settings → Account → Invoice history: every invoice of the user's subscription (Stripe). */
export default async function InvoicesPage() {
  const user = (await getCurrentUser())!;
  const [t, account] = await Promise.all([getT(), getPersonalAccount(user.id)]);
  const locale = getLocale();
  const s = stripe();
  let rows: { id: string; number: string | null; date: number; amount: number; currency: string; status: string | null; pdf: string | null; view: string | null }[] = [];
  let failed = false;
  if (s && account?.stripeCustomerId) {
    try {
      for await (const i of s.invoices.list({ customer: account.stripeCustomerId, limit: 100 })) {
        rows.push({ id: i.id!, number: i.number, date: i.created * 1000, amount: i.total, currency: i.currency, status: i.status,
          pdf: i.invoice_pdf ?? null, view: i.hosted_invoice_url ?? null });
        if (rows.length >= 500) break;
      }
    } catch { failed = true; rows = []; }
  }
  const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const money = (cents: number, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  const STATUS: Record<string, string> = { paid: 'Paid', open: 'Due', draft: 'Draft', void: 'Void', uncollectible: 'Uncollectible' };

  return (
    <section className="st-section">
      <Link href="/settings/account" className="back-link">← {t('Account')}</Link>
      <h2>{t('Invoice history')}</h2>
      {failed ? <p className="form-msg err">{t('Couldn’t load invoices.')}</p>
        : rows.length === 0 ? <p className="field-hint">{t('No invoices yet.')}</p> : (
          <div className="table-wrap">
            <table className="data-table st-invoice-table">
              <thead><tr><th>{t('Date')}</th><th>{t('Invoice')}</th><th>{t('Status')}</th><th className="num">{t('Amount')}</th><th className="num" /></tr></thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td>{date(i.date)}</td>
                    <td className="mono">{i.number ?? '—'}</td>
                    <td><span className={`inv-status ${i.status ?? ''}`}>{t(STATUS[i.status ?? ''] ?? i.status ?? '—')}</span></td>
                    <td className="num">{money(i.amount, i.currency)}</td>
                    <td className="num">
                      {i.pdf ? <a href={i.pdf} target="_blank" rel="noopener noreferrer">{t('Download')}</a>
                        : i.view ? <a href={i.view} target="_blank" rel="noopener noreferrer">{t('View')}</a> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}
