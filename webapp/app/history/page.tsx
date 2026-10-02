import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { TENDER_CATEGORIES, oppCategoryLabel, titleOf } from '@/lib/data';
import FilterSelect from '@/components/FilterSelect';

// Status as of now: a stored OPEN/SIGNAL whose deadline has passed is closed.
function displayStatus(o: { status: string | null; deadline: string | null }) {
  if (o.status === 'OPEN' || o.status === 'SIGNAL') {
    return o.deadline && new Date(o.deadline) < new Date() ? 'CLOSED' : o.status;
  }
  if (o.status === 'REJECTED') return 'NOT AN OPPORTUNITY';
  return o.status || 'UNVERIFIED';
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
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

  const sort: SortKey = (Object.keys(SORTS) as SortKey[]).find((k) => k === searchParams.sort) ?? 'deadline';
  const reversed = searchParams.dir === 'rev';
  const all = (data || []) as Row[];
  const rows = [...all.filter(HAS[sort]).sort((a, b) => (reversed ? -1 : 1) * SORTS[sort](a, b)), ...all.filter((r) => !HAS[sort](r))];

  const sortHref = (key: SortKey) => {
    const p = new URLSearchParams();
    if (searchParams.type) p.set('type', searchParams.type);
    if (searchParams.country) p.set('country', searchParams.country);
    p.set('sort', key);
    if (sort === key && !reversed) p.set('dir', 'rev');
    return `/history?${p.toString()}`;
  };
  const SortHead = ({ k, label, num }: { k: SortKey; label: string; num?: boolean }) => {
    const on = sort === k;
    return (
      <th className={num ? 'num' : undefined} aria-sort={on ? (reversed ? 'descending' : 'ascending') : undefined}>
        <Link href={sortHref(k)} className={`sort-head ${on ? 'on' : ''}`} title={`Sort by ${label.toLowerCase()}`}>
          {label}
          <svg className={`sort-arrow ${on && reversed ? 'up' : ''}`} viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.5v7M3 6.5l3 3 3-3" /></svg>
        </Link>
      </th>
    );
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="opps-h1">Tender History</h1>
        <div className="page-head-stat"><span className="mono">{rows.length}</span> records</div>
      </div>

      <div className="filter-inline">
        <FilterSelect name="type" label="Type" options={TENDER_CATEGORIES.map(({ slug, label }) => ({ value: slug, label }))} />
        <FilterSelect name="country" label="Country" options={countries} />
      </div>

      {error && <div className="callout error"><strong>Error.</strong> {error.message}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <SortHead k="country" label="Country" />
              <th>Type</th>
              <th>Status</th>
              <SortHead k="relevance" label="Relevance" num />
              <SortHead k="value" label="Value" num />
              <SortHead k="deadline" label="Proposal deadline" />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const status = displayStatus(o as any);
              return (
                <tr key={o.opportunity_id} className="data-row">
                  <td className="title-cell"><Link href={`/tenders/${o.opportunity_id}`}>{titleOf(o as any)}</Link></td>
                  <td className="mono" title={o.country ? countryName.get(o.country) ?? '' : ''}>{o.country || '—'}</td>
                  <td>{o.opportunity_type && <span className={`tag ${o.opportunity_type}`}>{oppCategoryLabel(o.opportunity_type)}</span>}</td>
                  <td>
                    <span className={`status ${status.toLowerCase().replace(/ /g, '-')}`} title={o.status_evidence || ''}>{status}</span>
                  </td>
                  <td className="num mono">{o.opportunity_relevance_score ?? '—'}</td>
                  <td className="num mono nowrap">{money(o.estimated_value, o.currency)}</td>
                  <td className="mono nowrap">{fmt(o.deadline)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !error && (
          <div className="panel-empty">No tenders match these filters.</div>
        )}
      </div>
    </div>
  );
}
