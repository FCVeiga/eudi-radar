import { OPP_CATEGORIES, NEW_WINDOW_DAYS, getActiveOpportunities, isNew } from '@/lib/data';
import OpportunityCard from './OpportunityCard';
import SectionTabs from './SectionTabs';

type View = 'all' | 'new' | (typeof OPP_CATEGORIES)[number]['slug'];

const HEADINGS: Record<string, { title: string; sub: string }> = {
  all: { title: 'Opportunities', sub: 'Every active opportunity — closed and awarded ones live in the Database' },
  new: { title: 'New', sub: `Active opportunities that appeared in the last ${NEW_WINDOW_DAYS} days, across all categories` },
  ...Object.fromEntries(OPP_CATEGORIES.map((c) => [c.slug, { title: c.label, sub: c.blurb }])),
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
  const activeHref = view === 'all' ? '/opportunities' : view === 'new' ? '/opportunities/new'
    : `/opportunities/${OPP_CATEGORIES.find((c) => c.slug === view)!.path}`;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Opportunities</div>
          <h1>{HEADINGS[view].title}</h1>
          <p className="page-sub">{HEADINGS[view].sub}</p>
        </div>
      </div>
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
      <div className="opp-grid">
        {shown.map((o) => <OpportunityCard key={o.opportunity_id} o={o} />)}
      </div>
    </div>
  );
}
