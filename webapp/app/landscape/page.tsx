import { getSupabaseServerClient } from '@/lib/supabase';
import LandscapeMap from './LandscapeMap';

export default async function LandscapePage() {
  const supabase = getSupabaseServerClient();

  const { data: countries, error } = await supabase
    .from('countries')
    .select('name, eudi_wallet_authority, wallet_name, wallet_status_raw, country_url, national_procurement_portal');

  const landscapeData: Record<string, { idSystems: { name: string; url: string }[]; companies: { name: string; url: string }[] }> = {};
  for (const c of countries || []) {
    const idSystems = [];
    if (c.wallet_name) {
      idSystems.push({ name: `${c.wallet_name} (${c.wallet_status_raw || 'status unknown'})`, url: c.country_url || '#' });
    }
    landscapeData[c.name] = { idSystems, companies: [] };
  }

  return (
    <div>
      <div className="hero">
        <div><h1>Landscape</h1><div className="hero-sub">National digital identity trust frameworks &amp; wallet-space companies by country</div></div>
      </div>
      {error && <div className="detail-block"><h2>Error</h2><p>{error.message}</p></div>}
      <div className="sample-note">
        <strong>Company data not yet populated.</strong> ID system status comes
        from config/countries.yaml (real, sourced data). Wallet-space company
        listings per country require agents/consortium.py's partner graph to
        be populated — currently empty for every country.
      </div>
      <LandscapeMap data={landscapeData} />
    </div>
  );
}
