import { getSupabaseServerClient } from '@/lib/supabase';
import { TRANSLATION_PENDING, nameInLanguage, firstInLanguage, inPlatformLanguage } from '@/lib/english';
import { getPlatformLanguage } from '@/lib/language';
import { getScopeItems, getViewScopes } from '@/lib/scopes';

// Opportunity categories — must match OPPORTUNITY_TYPES values in run_daily.py.
export const OPP_CATEGORIES = [
  { slug: 'rfp', path: 'rfps', label: 'RFPs', blurb: 'Open calls for tenders and contract notices' },
  { slug: 'rfi', path: 'rfis', label: 'RFIs', blurb: 'Requests for information, market consultations and prior information notices' },
  { slug: 'grant', path: 'grants', label: 'Grants', blurb: 'Grants, calls for proposals, consortium calls and funded pilots' },
  { slug: 'signal', path: 'signals', label: 'Signals', blurb: 'A named buyer has announced a procurement that isn\u2019t open yet — TED prior information notices, approved budgets, mandated systems. Dated within the last 6 months.' },
] as const;

// Tenders, RFIs and grants: what Opportunities and Tender History list. Signals
// are announcements, not open calls, so they live on the home feed and in News.
export const TENDER_CATEGORIES = OPP_CATEGORIES.filter((c) => c.slug !== 'signal');

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
  authority_en: string | null;
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
  duration_months: number | null;
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
  image_url: string | null;
  summary_long?: string | null;
  analysis?: unknown;
};

/** English title: title_en, else a cleaner English fallback (e.g. the agent's headline),
 * else the original only if it is English. */
export const titleOf = (x: { title: string; title_en?: string | null; language?: string | null }, ...fallbacks: (string | null | undefined)[]) =>
  firstInLanguage(x.title_en, ...fallbacks, inPlatformLanguage(x.title, x.language) ? x.title : null) ?? TRANSLATION_PENDING;

/** Buyer / organisation in English (null when no English form exists yet). */
export const buyerOf = (o: { authority: string | null; authority_en?: string | null }) => nameInLanguage(o.authority_en, o.authority);

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
 * Closed, awarded and unverified items only appear on the History page.
 */
export async function getActiveOpportunities(category?: string) {
  await getPlatformLanguage();  // the display filter's language
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
  const opportunities = await inScopes(((data || []) as Opportunity[]).filter(
    (o) => o.status !== 'SIGNAL' || o.deadline || !o.publication_date || new Date(o.publication_date).getTime() >= cutoff,
  ));
  return { opportunities, error };
}

/**
 * Only the tenders the viewer's scopes found (lib/scopes.ts), each with the
 * best relevance those scopes gave it and the best fit their evaluations
 * scored — sorted by that relevance.
 */
export async function inScopes<T extends { opportunity_id: string; opportunity_relevance_score?: number | null; bid_readiness_score?: number | null }>(rows: T[]): Promise<T[]> {
  const items = await getScopeItems('tender');
  if (!items) return rows;
  const kept = rows.filter((o) => items.relevance.has(o.opportunity_id));
  const { scopes } = await getViewScopes();
  const { data: evals } = kept.length && scopes.length
    ? await getSupabaseServerClient().from('scope_evaluations').select('opportunity_id, evaluation')
        .in('scope_id', scopes.map((s) => s.id)).in('opportunity_id', kept.map((o) => o.opportunity_id)).not('evaluation', 'is', null)
    : { data: [] as any[] };
  const fit = new Map<string, number>();
  for (const e of evals || []) fit.set(e.opportunity_id, Math.max(fit.get(e.opportunity_id) ?? 0, Number(e.evaluation?.fit_score) || 0));
  return kept.map((o) => ({ ...o, opportunity_relevance_score: items.relevance.get(o.opportunity_id) ?? o.opportunity_relevance_score,
                            bid_readiness_score: fit.get(o.opportunity_id) ?? null }))
    .sort((a, b) => (b.opportunity_relevance_score ?? 0) - (a.opportunity_relevance_score ?? 0));
}

export async function getNews(category?: string, limit?: number) {
  await getPlatformLanguage();  // the display filter's language
  const supabase = getSupabaseServerClient();
  let q = supabase.from('news_items').select('*').order('published_date', { ascending: false });
  if (category) q = q.eq('category', category);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  // Only stories the viewer's scopes found, with the best importance they gave.
  const items = await getScopeItems('news');
  const news = ((data || []) as NewsItem[]).filter((n) => !items || items.relevance.has(n.news_id))
    .map((n) => (items ? { ...n, relevance_score: items.relevance.get(n.news_id) ?? n.relevance_score } : n));
  return { news, error };
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

