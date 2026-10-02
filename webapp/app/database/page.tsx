import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';
import { OPP_CATEGORIES, oppCategoryLabel, titleOf } from '@/lib/data';

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

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: { type?: string; country?: string };
}) {
  const supabase = getSupabaseServerClient();

  let query = supabase.from('opportunities').select('*').order('first_detected', { ascending: false });
  if (searchParams.type) query = query.eq('opportunity_type', searchParams.type);
  if (searchParams.country) query = query.eq('country', searchParams.country);
  const { data: opportunities, error } = await query;

  const { data: countryRows } = await supabase.from('opportunities').select('country');
  const countries = Array.from(new Set((countryRows || []).map((r) => r.country).filter(Boolean))).sort();

  const href = (type?: string, country?: string) => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (country) p.set('country', country);
    const q = p.toString();
    return `/database${q ? `?${q}` : ''}`;
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Database</div>
          <h1>Everything analysed</h1>
          <p className="page-sub">The full record, including closed, awarded and unverified opportunities. Hover a status to see the evidence behind it.</p>
        </div>
        <div className="page-head-stat"><span className="mono">{(opportunities || []).length}</span> records</div>
      </div>

      <div className="filter-row">
        <span className="filter-label">Type</span>
        <Link href={href(undefined, searchParams.country)} className={`chip ${!searchParams.type ? 'active' : ''}`}>All</Link>
        {OPP_CATEGORIES.map(({ slug, label }) => (
          <Link key={slug} href={href(slug, searchParams.country)} className={`chip ${searchParams.type === slug ? 'active' : ''}`}>
            {label}
          </Link>
        ))}
      </div>
      <div className="filter-row">
        <span className="filter-label">Country</span>
        <Link href={href(searchParams.type)} className={`chip ${!searchParams.country ? 'active' : ''}`}>All</Link>
        {countries.map((c) => (
          <Link key={c} href={href(searchParams.type, c)} className={`chip mono ${searchParams.country === c ? 'active' : ''}`}>{c}</Link>
        ))}
      </div>

      {error && <div className="callout error"><strong>Error.</strong> {error.message}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Country</th><th>Type</th><th>Status</th><th className="num">Relevance</th><th className="num">Fit</th><th>Deadline</th></tr>
          </thead>
          <tbody>
            {(opportunities || []).map((o) => {
              const status = displayStatus(o);
              return (
                <tr key={o.opportunity_id} className="data-row">
                  <td className="title-cell"><Link href={`/opportunities/${o.opportunity_id}`}>{titleOf(o)}</Link></td>
                  <td className="mono">{o.country || '—'}</td>
                  <td>{o.opportunity_type && <span className={`tag ${o.opportunity_type}`}>{oppCategoryLabel(o.opportunity_type)}</span>}</td>
                  <td>
                    <span className={`status ${status.toLowerCase().replace(/ /g, '-')}`} title={o.status_evidence || ''}>{status}</span>
                  </td>
                  <td className="num mono">{o.opportunity_relevance_score ?? '—'}</td>
                  <td className="num mono">{o.bid_readiness_score ?? '—'}</td>
                  <td className="mono nowrap">{fmt(o.deadline)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(!opportunities || opportunities.length === 0) && !error && (
          <div className="panel-empty">No opportunities match these filters.</div>
        )}
      </div>
    </div>
  );
}
