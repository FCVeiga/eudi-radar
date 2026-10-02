import Link from 'next/link';
import {
  NEW_WINDOW_DAYS, Opportunity, appearedAt, daysUntil, getActiveOpportunities, getNews, getRecentChanges,
  isNew, isUpdated, oppCategoryLabel,
} from '@/lib/data';
import { DeadlineText, StatusTags } from '@/components/OpportunityCard';
import NewsRow from '@/components/NewsRow';

const CLOSING_SOON_DAYS = 30;

function OppRow({ o }: { o: Opportunity }) {
  return (
    <Link href={`/opportunities/${o.opportunity_id}`} className="list-row">
      <div className="list-row-main">
        <div className="opp-tags"><StatusTags o={o} /></div>
        <div className="list-row-title">{o.title}</div>
        <div className="list-row-meta">
          {o.country || 'Intl'} <span className="sep">·</span> <DeadlineText deadline={o.deadline} />
        </div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const now = new Date();
  const [{ opportunities: active, error: oppError }, { news, error: newsError }, { changes }] =
    await Promise.all([getActiveOpportunities(), getNews(), getRecentChanges(14)]);

  const newOnes = active.filter((o) => isNew(o, now));
  const updated = active.filter((o) => !isNew(o, now) && isUpdated(o, now));
  const closingSoon = active
    .filter((o) => { const d = daysUntil(o.deadline, now); return d !== null && d >= 0 && d <= CLOSING_SOON_DAYS; })
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  const newsThisWeek = news.filter((n) => n.published_date && now.getTime() - new Date(n.published_date).getTime() <= 7 * 86400_000);

  // Highlights: the most relevant new opportunities, topped up with the most
  // relevant active ones if fewer than three are new. `active` is relevance-sorted.
  const highlights = [...newOnes, ...active.filter((o) => !isNew(o, now))].slice(0, 3);
  const latestOpps = [...active]
    .sort((a, b) => (appearedAt(b)?.getTime() ?? 0) - (appearedAt(a)?.getTime() ?? 0))
    .slice(0, 6);

  const today = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">{today}</div>
          <h1>Today&apos;s briefing</h1>
          <p className="page-sub">Open digital-identity and wallet opportunities, deadline changes and market news.</p>
        </div>
      </div>

      {(oppError || newsError) && (
        <div className="callout error"><strong>Error loading data.</strong> {oppError?.message || newsError?.message}</div>
      )}

      <div className="kpi-row">
        <Link href="/opportunities" className="kpi">
          <div className="kpi-label">Active opportunities</div>
          <div className="kpi-num">{active.length}</div>
        </Link>
        <Link href="/opportunities/new" className="kpi">
          <div className="kpi-label">New · last {NEW_WINDOW_DAYS} days</div>
          <div className="kpi-num">{newOnes.length}</div>
          {updated.length > 0 && <div className="kpi-note">+{updated.length} updated</div>}
        </Link>
        <div className="kpi">
          <div className="kpi-label">Closing · next {CLOSING_SOON_DAYS} days</div>
          <div className={`kpi-num ${closingSoon.length ? 'warn' : ''}`}>{closingSoon.length}</div>
        </div>
        <Link href="/news" className="kpi">
          <div className="kpi-label">News · this week</div>
          <div className="kpi-num">{newsThisWeek.length}</div>
        </Link>
      </div>

      <div className="home-grid">
        <section>
          <div className="section-head">
            <h2 className="section-title">Highlights</h2>
            <Link href="/opportunities" className="section-more">All opportunities →</Link>
          </div>
          {highlights.length === 0 && <div className="callout">No active opportunities right now.</div>}
          <div className="highlight-list">
            {highlights.map((o) => (
              <Link key={o.opportunity_id} href={`/opportunities/${o.opportunity_id}`} className="highlight">
                <div className="highlight-top">
                  <div className="opp-tags"><StatusTags o={o} /></div>
                  <span className="score-pill" title="Relevance score">{o.opportunity_relevance_score ?? '—'}</span>
                </div>
                <div className="highlight-title">{o.title}</div>
                {o.authority && <div className="opp-card-authority">{o.authority}</div>}
                {o.summary && <p className="highlight-summary">{o.summary}</p>}
                <div className="list-row-meta">
                  <span className="country-chip">{o.country || 'Intl'}</span>
                  <span className="foot-label">Deadline</span> <DeadlineText deadline={o.deadline} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <aside className="side-stack">
          <div className="panel">
            <div className="panel-head"><h3>Closing soon</h3></div>
            {closingSoon.length === 0 && <div className="panel-empty">No deadlines in the next {CLOSING_SOON_DAYS} days.</div>}
            {closingSoon.slice(0, 6).map((o) => {
              const d = daysUntil(o.deadline, now)!;
              return (
                <Link key={o.opportunity_id} href={`/opportunities/${o.opportunity_id}`} className="panel-row">
                  <span className={`day-badge ${d <= 14 ? 'due-soon' : ''}`}>{d === 0 ? 'today' : `${d}d`}</span>
                  <span className="panel-row-body">
                    <span className="panel-row-title">{o.title}</span>
                    <span className="panel-row-meta">{o.country || 'Intl'} · {oppCategoryLabel(o.opportunity_type)}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Recent updates</h3></div>
            {changes.length === 0 && <div className="panel-empty">No changes to tracked opportunities in the last 14 days.</div>}
            {changes.map((c) => (
              <Link key={c.id} href={`/opportunities/${c.opportunity_id}`} className="panel-row">
                <span className="date-badge">
                  {c.detected_at ? new Date(c.detected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                </span>
                <span className="panel-row-body">
                  <span className="panel-row-title">{c.opportunities?.title}</span>
                  <span className="panel-row-meta change">{c.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </div>

      <div className="latest-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Latest opportunities</h3>
            <Link href="/opportunities" className="section-more">View all →</Link>
          </div>
          {latestOpps.length === 0 && <div className="panel-empty">Nothing yet.</div>}
          {latestOpps.map((o) => <OppRow key={o.opportunity_id} o={o} />)}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h3>Latest news</h3>
            <Link href="/news" className="section-more">View all →</Link>
          </div>
          {news.slice(0, 6).map((n) => <NewsRow key={n.news_id} n={n} compact />)}
        </section>
      </div>
    </div>
  );
}
