import { OPP_CATEGORIES, NEW_WINDOW_DAYS, getActiveOpportunities, isNew } from '@/lib/data';
import { getSupabaseServerClient } from '@/lib/supabase';
import OpportunityRow, { RingGradients } from './OpportunityRow';
import SectionTabs from './SectionTabs';

type View = 'all' | 'new' | (typeof OPP_CATEGORIES)[number]['slug'];

const TITLES: Record<string, string> = {
  all: 'Opportunities', new: 'New opportunities',
  ...Object.fromEntries(OPP_CATEGORIES.map((c) => [c.slug, c.label])),
};

export default async function OpportunitiesView({ view }: { view: View }) {
  // One query for the whole active set: the tab counts and the list come from it.
  const { opportunities: active, error } = await getActiveOpportunities();
  const now = new Date();
  const newOnes = active.filter((o) => isNew(o, now));
  const shown =
    view === 'all' ? active : view === 'new' ? newOnes : active.filter((o) => o.opportunity_type === view);

  const tabs = [
    { href: '/opportunities', label: 'All active', count: active.length },
    { href: '/opportunities/new', label: 'New', count: newOnes.length },
    ...OPP_CATEGORIES.map((c) => ({
      href: `/opportunities/${c.path}`,
      label: c.label,
      count: active.filter((o) => o.opportunity_type === c.slug).length,
    })),
  ];
  // Agent-written copy (informative description, English headline) and country names.
  const db = getSupabaseServerClient();
  const [{ data: posts }, { data: countries }] = await Promise.all([
    shown.length ? db.from('feed_posts').select('post_id, headline, body').in('post_id', shown.map((o) => `opp:${o.opportunity_id}`)) : Promise.resolve({ data: [] as any[] }),
    db.from('countries').select('code, name'),
  ]);
  const copy = new Map((posts || []).map((p: any) => [p.post_id.slice(4), p]));
  const names = new Map((countries || []).map((c: any) => [c.code, c.name]));

  const activeHref = view === 'all' ? '/opportunities' : view === 'new' ? '/opportunities/new'
    : `/opportunities/${OPP_CATEGORIES.find((c) => c.slug === view)!.path}`;

  return (
    <div>
      <h1 className="opps-h1">{TITLES[view]}</h1>
      <SectionTabs tabs={tabs} active={activeHref} />

      {error && (
        <div className="callout error"><strong>Error loading opportunities.</strong> {error.message}</div>
      )}
      {!error && shown.length === 0 && (
        <div className="callout">
          <strong>Nothing here right now.</strong>{' '}
          {view === 'new'
            ? `No active opportunity has appeared in the last ${NEW_WINDOW_DAYS} days.`
            : 'No active opportunities in this category. Closed and awarded ones are on the Database page.'}
        </div>
      )}
      <RingGradients />
      <div className="opp-rows">
        {shown.map((o) => (
          <OpportunityRow key={o.opportunity_id} o={o} copy={copy.get(o.opportunity_id)}
                          countryName={o.country ? names.get(o.country) ?? null : null} />
        ))}
      </div>
    </div>
  );
}
