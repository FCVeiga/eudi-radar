import { OPP_CATEGORIES, TENDER_CATEGORIES, NEW_WINDOW_DAYS, getActiveOpportunities, isNew } from '@/lib/data';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getLikes } from '@/lib/likes';
import OpportunityRow, { RingGradients } from './OpportunityRow';
import type { UpdateEvent } from './UpdateComment';
import SectionTabs from './SectionTabs';

type View = 'all' | 'new' | (typeof OPP_CATEGORIES)[number]['slug'];

const TITLES: Record<string, string> = {
  all: 'Tenders', new: 'New tenders',
  ...Object.fromEntries(OPP_CATEGORIES.map((c) => [c.slug, c.label])),
};

export default async function OpportunitiesView({ view }: { view: View }) {
  // One query for the whole active set: the tab counts and the list come from it.
  const { opportunities: all, error } = await getActiveOpportunities();
  const active = all.filter((o) => o.opportunity_type !== 'signal');  // signals: home feed and News
  const now = new Date();
  const newOnes = active.filter((o) => isNew(o, now));
  const shown =
    view === 'all' ? active : view === 'new' ? newOnes : active.filter((o) => o.opportunity_type === view);

  const tabs = [
    { href: '/tenders', label: 'All active', count: active.length },
    { href: '/tenders/new', label: 'New', count: newOnes.length },
    ...TENDER_CATEGORIES.map((c) => ({
      href: `/tenders/${c.path}`,
      label: c.label,
      count: active.filter((o) => o.opportunity_type === c.slug).length,
    })),
  ];
  // Agent-written copy (informative description, English headline) and country names.
  const db = getSupabaseServerClient();
  const ids = shown.map((o) => o.opportunity_id);
  const [{ data: posts }, { data: countries }, { data: changes }] = await Promise.all([
    ids.length ? db.from('feed_posts').select('post_id, headline, body').in('post_id', ids.map((id) => `opp:${id}`)) : Promise.resolve({ data: [] as any[] }),
    db.from('countries').select('code, name'),
    ids.length ? db.from('change_events').select('*').in('opportunity_id', ids).order('detected_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ]);
  const likes = await getLikes('tender', ids);
  const updates = new Map<string, UpdateEvent[]>();
  for (const c of (changes || []) as UpdateEvent[]) updates.set(c.opportunity_id, [...(updates.get(c.opportunity_id) || []), c]);
  const copy = new Map((posts || []).map((p: any) => [p.post_id.slice(4), p]));
  const names = new Map((countries || []).map((c: any) => [c.code, c.name]));

  const activeHref = view === 'all' ? '/tenders' : view === 'new' ? '/tenders/new'
    : `/tenders/${OPP_CATEGORIES.find((c) => c.slug === view)!.path}`;

  return (
    <div>
      <h1 className="opps-h1">{TITLES[view]}</h1>
      <SectionTabs tabs={tabs} active={activeHref} />

      {error && (
        <div className="callout error"><strong>Error loading tenders.</strong> {error.message}</div>
      )}
      {!error && shown.length === 0 && (
        <div className="callout">
          <strong>Nothing here right now.</strong>{' '}
          {view === 'new'
            ? `No active tender has appeared in the last ${NEW_WINDOW_DAYS} days.`
            : 'No active tenders in this category. Closed and awarded ones are on the History page.'}
        </div>
      )}
      <RingGradients />
      <div className="opp-rows">
        {shown.map((o) => (
          <OpportunityRow key={o.opportunity_id} o={o} copy={copy.get(o.opportunity_id)}
                          like={{ liked: likes.liked.has(o.opportunity_id), signedIn: likes.signedIn }}
                          countryName={o.country ? names.get(o.country) ?? null : null}
                          updates={updates.get(o.opportunity_id) ?? []} />
        ))}
      </div>
    </div>
  );
}
