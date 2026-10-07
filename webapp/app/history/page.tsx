import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { TENDER_CATEGORIES, oppCategoryLabel, titleOf } from '@/lib/data';
import FilterSelect from '@/components/FilterSelect';
import { getScopeItems } from '@/lib/scopes';
import SortSelect from '@/components/SortSelect';
import { getPlatformLanguage } from '@/lib/language';
import { getLocale, getT } from '@/lib/i18n/server';
import { getCurrentUser } from '@/lib/auth';
import SignUpGate from '@/components/SignUpGate';

// Status as of now: a stored OPEN/SIGNAL whose deadline has passed is closed.
function displayStatus(o: { status: string | null; deadline: string | null }) {
  if (o.status === 'OPEN' || o.status === 'SIGNAL') {
    return o.deadline && new Date(o.deadline) < new Date() ? 'CLOSED' : o.status;
  }
  if (o.status === 'REJECTED') return 'NOT AN OPPORTUNITY';
  return o.status || 'UNVERIFIED';
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const money = (v: number | null, cur: string | null) =>
  v ? `${cur || ''} ${v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : v}`.trim() : '—';


// Each sortable column and its first-click order: latest proposal deadline
// (the default sort), highest relevance, highest value, country A–Z.
// Clicking again reverses it.
type SortKey = 'deadline' | 'relevance' | 'value' | 'country';
type Row = Record<string, any>;
const SORTS: Record<SortKey, (a: Row, b: Row) => number> = {
  deadline: (a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime(),
  relevance: (a, b) => (b.opportunity_relevance_score ?? -1) - (a.opportunity_relevance_score ?? -1),
  value: (a, b) => (b.estimated_value ?? -1) - (a.estimated_value ?? -1),
  country: (a, b) => String(a.country).localeCompare(String(b.country)),
};
// Rows without the sorted field always go last, whichever the direction.
const HAS: Record<SortKey, (r: Row) => boolean> = {
  deadline: (r) => !!r.deadline, relevance: (r) => r.opportunity_relevance_score != null,
  value: (r) => !!r.estimated_value, country: (r) => !!r.country,
};

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: { type?: string; country?: string; sort?: string; dir?: string };
}) {
  await getPlatformLanguage();  // the display filter's language
  const t = await getT();
  if (!(await getCurrentUser())) {
    return (
      <div>
        <div className="page-head"><h1 className="opps-h1">{t('Tender History')}</h1></div>
        <SignUpGate />
      </div>
    );
  }
  const supabase = getSupabaseServerClient();

  let query = supabase.from('opportunities').select('*')
    .or('opportunity_type.is.null,opportunity_type.neq.signal')
    .order('first_detected', { ascending: false });
  if (searchParams.type) query = query.eq('opportunity_type', searchParams.type);
  if (searchParams.country) query = query.eq('country', searchParams.country);
  const [{ data, error }, { data: countryRows }, { data: names }] = await Promise.all([
    query,
    supabase.from('opportunities').select('country').or('opportunity_type.is.null,opportunity_type.neq.signal'),
    supabase.from('countries').select('code, name'),
  ]);
  const countryName = new Map((names || []).map((c: any) => [c.code, c.name]));
  const countries = Array.from(new Set((countryRows || []).map((r) => r.country).filter(Boolean)))
    .map((c) => ({ value: c as string, label: countryName.get(c) ?? c }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Only the tenders the viewer's scopes found (lib/scopes.ts), with their relevance.
  const scopeItems = await getScopeItems('tender');
  const sort: SortKey = (Object.keys(SORTS) as SortKey[]).find((k) => k === searchParams.sort) ?? 'deadline';
  const reversed = searchParams.dir === 'rev';
  const all = ((data || []) as Row[]).filter((r) => !scopeItems || scopeItems.relevance.has(r.opportunity_id))
    .map((r) => (scopeItems ? { ...r, opportunity_relevance_score: scopeItems.relevance.get(r.opportunity_id) ?? r.opportunity_relevance_score } : r));
  const rows = [...all.filter(HAS[sort]).sort((a, b) => (reversed ? -1 : 1) * SORTS[sort](a, b)), ...all.filter((r) => !HAS[sort](r))];

  const sortHref = (key: SortKey) => {
    const p = new URLSearchParams();
    if (searchParams.type) p.set('type', searchParams.type);
    if (searchParams.country) p.set('country', searchParams.country);
    p.set('sort', key);
    if (sort === key && !reversed) p.set('dir', 'rev');
    return `/history?${p.toString()}`;
  };
  const SortHead = ({ k, label, title, num }: { k: SortKey; label: string; title: string; num?: boolean }) => {
    const on = sort === k;
    return (
      <th className={num ? 'num' : undefined} aria-sort={on ? (reversed ? 'descending' : 'ascending') : undefined}>
        <Link href={sortHref(k)} className={`sort-head ${on ? 'on' : ''}`} title={title}>
          {label}
          <svg className={`sort-arrow ${on && reversed ? 'up' : ''}`} viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.5v7M3 6.5l3 3 3-3" /></svg>
        </Link>
      </th>
    );
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="opps-h1">{t('Tender History')}</h1>
        <div className="page-head-stat"><span className="mono">{rows.length}</span> {rows.length === 1 ? t('record') : t('records')}</div>
      </div>

      <div className="filter-inline">
        <FilterSelect name="type" label={t('Type')} options={TENDER_CATEGORIES.map(({ slug, label }) => ({ value: slug, label: t(label) }))} />
        <FilterSelect name="country" label={t('Country')} options={countries} />
        <SortSelect options={[
          { sort: 'deadline', label: t('Latest deadline') }, { sort: 'deadline', dir: 'rev', label: t('Earliest deadline') },
          { sort: 'relevance', label: t('Highest relevance') }, { sort: 'value', label: t('Highest value') },
          { sort: 'country', label: t('Country A–Z') }, { sort: 'country', dir: 'rev', label: t('Country Z–A') },
        ]} />
      </div>

      {error && <div className="callout error"><strong>{t('Error.')}</strong> {error.message}</div>}

      <div className="table-wrap">
        <table className="data-table history-table">
          <thead>
            <tr>
              <th>{t('Title')}</th>
              <SortHead k="country" label={t('Country')} title={t('Sort by country')} />
              <th>{t('Type')}</th>
              <th>{t('Status')}</th>
              <SortHead k="relevance" label={t('Relevance')} title={t('Sort by relevance')} num />
              <SortHead k="value" label={t('Value')} title={t('Sort by value')} num />
              <SortHead k="deadline" label={t('Proposal deadline')} title={t('Sort by proposal deadline')} />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const status = displayStatus(o as any);
              return (
                <tr key={o.opportunity_id} className="data-row">
                  <td className="title-cell"><Link href={`/tenders/${o.opportunity_id}`}>{titleOf(o as any)}</Link></td>
                  <td className="mono cell-country" data-label={t('Country')} title={o.country ? countryName.get(o.country) ?? '' : ''}>{o.country || '—'}</td>
                  <td className="cell-type">{o.opportunity_type && <span className={`tag ${o.opportunity_type}`}>{t(oppCategoryLabel(o.opportunity_type))}</span>}</td>
                  <td className="cell-status">
                    <span className={`status ${status.toLowerCase().replace(/ /g, '-')}`} title={o.status_evidence || ''}>{t(status)}</span>
                  </td>
                  <td className="num mono" data-label={t('Relevance')}>{o.opportunity_relevance_score ?? '—'}</td>
                  <td className="num mono nowrap" data-label={t('Value')}>{money(o.estimated_value, o.currency)}</td>
                  <td className="mono nowrap" data-label={t('Proposal deadline')}>{fmt(o.deadline)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !error && (
          <div className="panel-empty">{t('No tenders match these filters.')}</div>
        )}
      </div>
    </div>
  );
}
