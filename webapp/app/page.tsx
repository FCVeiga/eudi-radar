import Link from 'next/link';
import {
  NEW_WINDOW_DAYS, Opportunity, appearedAt, daysUntil, getActiveOpportunities, getNews, isNew, oppCategoryLabel,
} from '@/lib/data';
import { DeadlineText } from '@/components/OpportunityCard';
import NewsRow, { formatDate } from '@/components/NewsRow';

const CLOSING_SOON_DAYS = 30;

function OppRow({ o }: { o: Opportunity }) {
  return (
    <Link href={`/opportunities/${o.opportunity_id}`} className="news-item compact">
      <div>
        {isNew(o) && <span className="tag new">New</span>}{' '}
        {o.opportunity_type && <span className={`tag ${o.opportunity_type}`}>{oppCategoryLabel(o.opportunity_type)}</span>}
        <div className="news-title">{o.title}</div>
        <div className="news-meta">{o.country || 'International'} · <DeadlineText deadline={o.deadline} /></div>
      </div>
      <div className="news-date">{formatDate(appearedAt(o)?.toISOString() ?? null)}</div>
    </Link>
  );
}

export default async function HomePage() {
  const now = new Date();
  const [{ opportunities: active, error: oppError }, { news, error: newsError }] =
    await Promise.all([getActiveOpportunities(), getNews()]);

  const newOnes = active.filter((o) => isNew(o, now));
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
      <div className="hero">
        <div>
          <h1>Today&apos;s briefing</h1>
          <div className="hero-sub">{today}</div>
        </div>
      </div>

      {(oppError || newsError) && (
        <div className="detail-block"><h2>Error loading data</h2><p>{oppError?.message || newsError?.message}</p></div>
      )}

      <div className="kpi-row">
        <Link href="/opportunities" className="kpi"><div className="stat-num">{active.length}</div><div className="stat-label">Active opportunities</div></Link>
        <Link href="/opportunities/new" className="kpi"><div className="stat-num">{newOnes.length}</div><div className="stat-label">New in the last {NEW_WINDOW_DAYS} days</div></Link>
        <div className="kpi"><div className="stat-num rust">{closingSoon.length}</div><div className="stat-label">Closing within {CLOSING_SOON_DAYS} days</div></div>
        <Link href="/news" className="kpi"><div className="stat-num fit">{newsThisWeek.length}</div><div className="stat-label">News items this week</div></Link>
      </div>

      <div className="home-grid">
        <section>
          <h2 className="section-title">Highlights</h2>
          {highlights.length === 0 && <div className="sample-note">No active opportunities yet.</div>}
          {highlights.map((o) => (
            <Link key={o.opportunity_id} href={`/opportunities/${o.opportunity_id}`} className="highlight">
              <div className="opp-tags">
                {isNew(o, now) && <span className="tag new">New</span>}
                {o.opportunity_type && <span className={`tag ${o.opportunity_type}`}>{oppCategoryLabel(o.opportunity_type)}</span>}
                <span className="highlight-score">Relevance {o.opportunity_relevance_score ?? '—'}</span>
              </div>
              <div className="opp-card-title">{o.title}</div>
              {o.summary && <p className="highlight-summary">{o.summary}</p>}
              <div className="news-meta">{o.country || 'International'}{o.authority ? ` · ${o.authority}` : ''} · <DeadlineText deadline={o.deadline} /></div>
            </Link>
          ))}
        </section>

        <aside className="closing-panel">
          <h2 className="section-title">Closing soon</h2>
          {closingSoon.length === 0 && <div className="sidebar-sub">No deadlines in the next {CLOSING_SOON_DAYS} days.</div>}
          {closingSoon.slice(0, 6).map((o) => {
            const d = daysUntil(o.deadline, now)!;
            return (
              <Link key={o.opportunity_id} href={`/opportunities/${o.opportunity_id}`} className="closing-item">
                <div className={`closing-days ${d <= 14 ? 'due-soon' : ''}`}>{d === 0 ? 'Today' : `${d}d`}</div>
                <div>
                  <div className="closing-title">{o.title}</div>
                  <div className="doc-type">{o.country || 'Intl'} · {oppCategoryLabel(o.opportunity_type)}</div>
                </div>
              </Link>
            );
          })}
        </aside>
      </div>

      <div className="latest-grid">
        <section>
          <div className="section-head">
            <h2 className="section-title">Latest opportunities</h2>
            <Link href="/opportunities" className="section-more">All opportunities →</Link>
          </div>
          {latestOpps.map((o) => <OppRow key={o.opportunity_id} o={o} />)}
        </section>
        <section>
          <div className="section-head">
            <h2 className="section-title">Latest news</h2>
            <Link href="/news" className="section-more">All news →</Link>
          </div>
          {news.slice(0, 6).map((n) => <NewsRow key={n.news_id} n={n} compact />)}
        </section>
      </div>
    </div>
  );
}
