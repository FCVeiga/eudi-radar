import { getSupabaseServerClient } from '@/lib/supabase';

// Opportunity categories — must match OPPORTUNITY_TYPES values in run_daily.py.
export const OPP_CATEGORIES = [
  { slug: 'rfp', path: 'rfps', label: 'RFPs', blurb: 'Open calls for tenders and contract notices' },
  { slug: 'rfi', path: 'rfis', label: 'RFIs', blurb: 'Requests for information, market consultations and prior information notices' },
  { slug: 'grant', path: 'grants', label: 'Grants', blurb: 'Grants, calls for proposals, consortium calls and funded pilots' },
  { slug: 'signal', path: 'signals', label: 'Signals', blurb: 'Early procurement signals — budgets, announced procurements, mandates — before any call is open' },
] as const;

// News sections — must match NEWS_CATEGORIES in run_daily.py.
export const NEWS_CATEGORIES = [
  { slug: 'regulation', label: 'Regulation', blurb: 'Laws, implementing acts, regulators, certification and standards' },
  { slug: 'industry', label: 'Industry', blurb: 'Vendors and industry players — launches, funding, partnerships, acquisitions' },
  { slug: 'market', label: 'Market', blurb: 'Governments, banks and other adopters launching or taking a stance on wallets' },
] as const;

export const NEW_WINDOW_DAYS = 5;

export type Opportunity = {
  opportunity_id: string;
  title: string;
  country: string | null;
  authority: string | null;
  opportunity_type: string | null;
  status: string | null;
  summary: string | null;
  publication_date: string | null;
  deadline: string | null;
  first_detected: string | null;
  estimated_value: number | null;
  currency: string | null;
  official_url: string | null;
  opportunity_relevance_score: number | null;
  bid_readiness_score: number | null;
};

export type NewsItem = {
  news_id: string;
  title: string;
  category: string | null;
  region: string | null;
  published_date: string | null;
  source_name: string | null;
  excerpt: string | null;
  summary: string | null;
  unverified: boolean | null;
};

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

export function daysUntil(iso: string | null, now = new Date()) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400_000);
}

/**
 * Active = not awarded/closed, and the deadline hasn't passed (or isn't stated).
 * Computed at query time so items drop off the moment their deadline passes;
 * closed and awarded items only appear on the Database page.
 */
export async function getActiveOpportunities(category?: string) {
  const supabase = getSupabaseServerClient();
  let q = supabase
    .from('opportunities')
    .select('*')
    .not('status', 'in', '(AWARDED,CLOSED)')
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
    .order('opportunity_relevance_score', { ascending: false });
  if (category) q = q.eq('opportunity_type', category);
  const { data, error } = await q;
  return { opportunities: (data || []) as Opportunity[], error };
}

export async function getNews(category?: string, limit?: number) {
  const supabase = getSupabaseServerClient();
  let q = supabase.from('news_items').select('*').order('published_date', { ascending: false });
  if (category) q = q.eq('category', category);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  return { news: (data || []) as NewsItem[], error };
}
