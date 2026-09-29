import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase';

const TYPES = ['tender', 'grant', 'pilot', 'consortium', 'signal'];

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: { type?: string; country?: string };
}) {
  const supabase = getSupabaseServerClient();

  let query = supabase.from('opportunities').select('*').order('first_detected', { ascending: false });

  if (searchParams.type) {
    query = query.ilike('opportunity_type', searchParams.type);
  }
  if (searchParams.country) {
    query = query.eq('country', searchParams.country);
  }

  const { data: opportunities, error } = await query;

  const { data: countryRows } = await supabase.from('opportunities').select('country');
  const countries = Array.from(new Set((countryRows || []).map((r) => r.country).filter(Boolean))).sort();

  return (
    <div>
      <div className="hero">
        <div><h1>Database</h1><div className="hero-sub">Full record of tenders, grants, pilots &amp; RFIs analysed</div></div>
      </div>

      <div className="filters">
        <Link href="/database" className={`filter-link ${!searchParams.type ? 'active' : ''}`}>All types</Link>
        {TYPES.map((t) => (
          <Link key={t} href={`/database?type=${t}${searchParams.country ? `&country=${searchParams.country}` : ''}`}
                className={`filter-link ${searchParams.type === t ? 'active' : ''}`}>
            {t.toUpperCase()}
          </Link>
        ))}
      </div>
      <div className="filters">
        <Link href={`/database${searchParams.type ? `?type=${searchParams.type}` : ''}`}
              className={`filter-link ${!searchParams.country ? 'active' : ''}`}>All regions</Link>
        {countries.map((c) => (
          <Link key={c} href={`/database?country=${c}${searchParams.type ? `&type=${searchParams.type}` : ''}`}
                className={`filter-link ${searchParams.country === c ? 'active' : ''}`}>
            {c}
          </Link>
        ))}
      </div>

      {error && <div className="detail-block"><h2>Error</h2><p>{error.message}</p></div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Country</th><th>Type</th><th>Status</th><th>Value</th><th>Relevance</th><th>Fit</th><th>Deadline</th></tr>
          </thead>
          <tbody>
            {(opportunities || []).map((o) => (
              <tr key={o.opportunity_id} className="data-row">
                <td><Link href={`/opportunities/${o.opportunity_id}`}>{o.title}</Link></td>
                <td>{o.country}</td>
                <td>{o.opportunity_type && <span className={`tag ${o.opportunity_type.toLowerCase()}`}>{o.opportunity_type}</span>}</td>
                <td>{o.status}</td>
                <td className="mono">{o.estimated_value ? `${o.currency || ''} ${o.estimated_value.toLocaleString()}` : '—'}</td>
                <td className="score-inline">{o.opportunity_relevance_score ?? '—'}</td>
                <td className="score-inline">{o.bid_readiness_score ?? '—'}</td>
                <td className="mono">{o.deadline ? new Date(o.deadline).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!opportunities || opportunities.length === 0) && !error && (
          <p style={{ padding: 20, color: 'var(--muted)' }}>No opportunities recorded yet — the daily pipeline hasn't populated this table.</p>
        )}
      </div>
    </div>
  );
}
