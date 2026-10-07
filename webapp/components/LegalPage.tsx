import { getLang, getLocale, getTSync } from '@/lib/i18n/server';

/** Layout for Help, Terms and Privacy: title, optional draft notice, readable prose. */
export default function LegalPage({ title, updated, draft, englishOnly, children }: {
  title: string; updated?: string; draft?: boolean; englishOnly?: boolean; children: React.ReactNode;
}) {
  const t = getTSync();
  const date = updated ? new Date(`${updated}T00:00:00`).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <article className="legal">
      <h1 className="opps-h1">{title}</h1>
      {date && <p className="legal-updated">{t('Last updated {date}', { date })}</p>}
      {englishOnly && getLang() !== 'en' && <p className="callout">{t('This document is available in English only.')}</p>}
      {draft && (
        <p className="callout legal-draft">
          <strong>{t('Draft for legal review.')}</strong> {t('Items in [brackets] are to be completed by the operator before this is relied on.')}
        </p>
      )}
      <div className="legal-body">{children}</div>
    </article>
  );
}
