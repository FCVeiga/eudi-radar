import { firstInLanguage } from '@/lib/english';
import { getTSync } from '@/lib/i18n/server';

export type Doc = {
  document_id: string; name: string; name_en: string | null; document_type: string | null;
  url: string | null; publication_date: string | null; downloaded_at: string | null;
};

// Display order and English labels for document types.
const GROUPS: [string, string][] = [
  ['CONTRACT_NOTICE', 'Notices'], ['CORRIGENDUM', 'Notices'],
  ['CLARIFICATION', 'Clarifications & Q&A'], ['Q_AND_A', 'Clarifications & Q&A'],
  ['TENDER_SPECIFICATIONS', 'Tender documents'], ['TECHNICAL_SPECIFICATIONS', 'Specifications'],
  ['AWARD_CRITERIA', 'Evaluation'], ['FINANCIAL_PROPOSAL', 'Price & financial forms'], ['FORM', 'Forms to complete'],
  ['CONTRACT', 'Contract'], ['ANNEX', 'Other documents'],
];
const ORDER = Array.from(new Set(GROUPS.map(([, g]) => g)));
const groupOf = (t: string | null) => GROUPS.find(([k]) => k === t)?.[1] ?? 'Other documents';

// Buyer-portal links that download the file itself (ePPS, DTVP).
const DIRECT = /downloadContractDocument|dtvp\.de\/Satellite\/public\/company\/project\/[^/]+\/\w+\/documents\//;

function linkKind(url: string | null) {
  if (!url) return null;
  if (/ted\.europa\.eu\/.*\/pdf$/.test(url)) return { label: 'PDF', title: 'Official TED notice (PDF)' };
  if (DIRECT.test(url)) return { label: 'Download', title: 'Direct download from the buyer portal' };
  return { label: 'Open on portal', title: 'Opens the buyer portal page where this document is downloaded' };
}

/** Tender documents grouped by type, with direct downloads where the portal allows. */
export default function TenderDocuments({ docs }: { docs: Doc[] }) {
  const t = getTSync();
  const groups = ORDER.map((g) => ({ g, items: docs.filter((d) => groupOf(d.document_type) === g) })).filter((x) => x.items.length);
  return (
    <div className="opp-sidebar">
      <h3>{t('Tender Documents')}</h3>
      <div className="sidebar-sub">{docs.length ? (docs.length === 1 ? t('{n} document', { n: docs.length }) : t('{n} documents', { n: docs.length })) : t('No documents found yet')}</div>
      {groups.map(({ g, items }) => (
        <div key={g} className="doc-group">
          <div className="doc-group-label">{t(g)} <span>{items.length}</span></div>
          {items.map((d) => {
            const k = linkKind(d.url);
            return (
              <a key={d.document_id} className="doc-item" href={d.url ?? '#'} target="_blank" rel="noopener noreferrer" title={k ? t(k.title) : undefined}>
                <span className="doc-name">{firstInLanguage(d.name_en) ?? d.name}</span>
                {k && <span className={`doc-download ${k.label === 'Open on portal' ? 'portal' : ''}`}>{k.label === 'Download' ? t('Download ↓') : k.label === 'PDF' ? 'PDF ↓' : t('Portal ↗')}</span>}
              </a>
            );
          })}
        </div>
      ))}
      {docs.some((d) => !DIRECT.test(d.url ?? '') && !/ted\.europa/.test(d.url ?? '')) && (
        <p className="sidebar-note">{t('“Portal ↗” documents download from the buyer\'s portal, which may ask you to register.')}</p>
      )}
    </div>
  );
}
