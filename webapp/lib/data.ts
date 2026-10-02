import { getSupabaseServerClient } from '@/lib/supabase';

// Opportunity categories — must match OPPORTUNITY_TYPES values in run_daily.py.
export const OPP_CATEGORIES = [
  { slug: 'rfp', path: 'rfps', label: 'RFPs', blurb: 'Open calls for tenders and contract notices' },
  { slug: 'rfi', path: 'rfis', label: 'RFIs', blurb: 'Requests for information, market consultations and prior information notices' },
  { slug: 'grant', path: 'grants', label: 'Grants', blurb: 'Grants, calls for proposals, consortium calls and funded pilots' },
  { slug: 'signal', path: 'signals', label: 'Signals', blurb: 'A named buyer has announced a procurement that isn\u2019t open yet — TED prior information notices, approved budgets, mandated systems. Dated within the last 6 months.' },
] as const;

// News sections — must match NEWS_CATEGORIES in run_daily.py.
export const NEWS_CATEGORIES = [
  { slug: 'regulation', label: 'Regulation', blurb: 'Laws, implementing acts, regulators, certification and standards' },
  { slug: 'industry', label: 'Industry', blurb: 'Vendors and industry players — launches, funding, partnerships, acquisitions' },
  { slug: 'market', label: 'Market', blurb: 'Governments, banks and other adopters launching or taking a stance on wallets' },
] as const;

export const NEW_WINDOW_DAYS = 5;
export const SIGNAL_MAX_AGE_DAYS = 183;

export type Opportunity = {
  opportunity_id: string;
  title: string;            // as published, original language
  title_en: string | null;  // English title from triage
  language: string | null;
  country: string | null;
  authority: string | null;
  opportunity_type: string | null;
  status: string | null;
  summary: string | null;
  status_evidence: string | null;
  verified_at: string | null;
  publication_date: string | null;
  deadline: string | null;
  first_detected: string | null;
  last_change: string | null;
  reference: string | null;
  estimated_value: number | null;
  currency: string | null;
  official_url: string | null;
  opportunity_relevance_score: number | null;
  bid_readiness_score: number | null;
};

export type NewsItem = {
  news_id: string;
  title: string;
  title_en: string | null;
  language: string | null;
  category: string | null;
  region: string | null;
  country: string | null;
  published_date: string | null;
  source_name: string | null;
  excerpt: string | null;
  summary: string | null;
  unverified: boolean | null;
  relevance_score: number | null;
  created_at: string | null;
};

/** English title when triage provided one, else the original. */
export const titleOf = (x: { title: string; title_en?: string | null }) => x.title_en || x.title;

export function oppCategoryLabel(slug: string | null) {
  return OPP_CATEGORIES.find((c) => c.slug === slug)?.label.replace(/s$/, '') ?? slug ?? '';
}

export function newsCategoryLabel(slug: string | null) {
  return NEWS_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug ?? '';
}

/** When the item "appeared": its publication date, else when the radar first saw it. */
export function appearedAt(o: Opportunity): Date | null {
  const d = o.publication_date || o.first_detected;
  return d ? new Date(d) : null;
}

export function isNew(o: Opportunity, now = new Date()) {
  const at = appearedAt(o);
  return !!at && now.getTime() - at.getTime() <= NEW_WINDOW_DAYS * 86400_000;
}

/** Changed (e.g. deadline extended) within the "new" window. */
export function isUpdated(o: Opportunity, now = new Date()) {
  return !!o.last_change && now.getTime() - new Date(o.last_change).getTime() <= NEW_WINDOW_DAYS * 86400_000;
}

export function daysUntil(iso: string | null, now = new Date()) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400_000);
}

/**
 * Active = status OPEN or SIGNAL (set only once the pipeline has confirmed it
 * against TED's structured data or the source page — "no deadline" alone never
 * counts), the deadline hasn't passed, and signals are under 6 months old.
 * Closed, awarded and unverified items only appear on the Database page.
 */
export async function getActiveOpportunities(category?: string) {
  const supabase = getSupabaseServerClient();
  let q = supabase
    .from('opportunities')
    .select('*')
    .in('status', ['OPEN', 'SIGNAL'])
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
    .order('opportunity_relevance_score', { ascending: false });
  if (category) q = q.eq('opportunity_type', category);
  const { data, error } = await q;
  const cutoff = Date.now() - SIGNAL_MAX_AGE_DAYS * 86400_000;
  const opportunities = ((data || []) as Opportunity[]).filter(
    (o) => o.status !== 'SIGNAL' || o.deadline || !o.publication_date || new Date(o.publication_date).getTime() >= cutoff,
  );
  return { opportunities, error };
}

export async function getNews(category?: string, limit?: number) {
  const supabase = getSupabaseServerClient();
  let q = supabase.from('news_items').select('*').order('published_date', { ascending: false });
  if (category) q = q.eq('category', category);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  return { news: (data || []) as NewsItem[], error };
}

export type ChangeEvent = {
  id: number;
  opportunity_id: string;
  event_type: string | null;
  description: string | null;
  detected_at: string | null;
  opportunities?: { title: string; country: string | null } | null;
};

/** Updates to tracked opportunities (deadline extensions, awards…), newest first. */
export async function getRecentChanges(days: number, limit = 8) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await getSupabaseServerClient()
    .from('change_events')
    .select('*, opportunities(title, country)')
    .gte('detected_at', since)
    .order('detected_at', { ascending: false })
    .limit(limit);
  return { changes: (data || []) as ChangeEvent[], error };
}

