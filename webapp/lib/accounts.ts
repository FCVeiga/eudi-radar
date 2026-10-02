/**
 * Followed accounts (home left sidebar) and their activity (Live activity).
 *
 * News sites and Reddit expose free RSS/Atom feeds, fetched here — lazily,
 * when the Live activity panel asks, and at most every REFRESH_MINUTES per
 * account. X/Twitter and LinkedIn have no free feed: those accounts are
 * listed but stay "not connected" (feed_url = null) until API access exists.
 */
import { XMLParser } from 'fast-xml-parser';
import { getSupabaseServerClient } from '@/lib/supabase';
import type { Platform } from '@/lib/platforms';

export { PLATFORMS, CATEGORIES } from '@/lib/platforms';
export type { Platform } from '@/lib/platforms';

const REFRESH_MINUTES = 10;
const FETCH_TIMEOUT_MS = 9000;
const ITEMS_PER_FETCH = 10;
// Honest, descriptive agent: some sites' firewalls block 'Mozilla/5.0 (compatible; …)' bots.
const UA = 'EUDI-Radar/1.0 (+https://eudi-radar.vercel.app; RSS reader)';

export type Account = {
  id: number; platform: Platform; handle_or_url: string; display_name: string; category: string | null;
  active: boolean; feed_url: string | null; last_fetched_at: string | null; last_error: string | null;
};

export type Activity = {
  id: number; account_id: number; title: string | null; url: string | null; published_at: string | null;
  tracked_accounts: { display_name: string; platform: Platform; handle_or_url: string } | null;
};

async function get(url: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: ctrl.signal, cache: 'no-store', redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { text: await res.text(), url: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

const isFeed = (text: string) => /<(rss|feed|rdf:RDF)[\s>]/i.test(text.slice(0, 2000));
// Entities are decoded here rather than by the parser: its entity expansion
// guard (anti XML-bomb) trips on ordinary feeds full of &amp;.
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : ENTITIES[e.toLowerCase()] ?? m);
const asText = (v: unknown): string => decode(
  typeof v === 'string' ? v : typeof v === 'number' ? String(v)
    : v && typeof v === 'object' && '#text' in (v as any) ? String((v as any)['#text']) : '');

/** Items of an RSS 2.0 / Atom / RSS 1.0 feed: { id, title, url, published }. */
export function parseFeed(xml: string) {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', processEntities: false }).parse(xml);
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.['rdf:RDF']?.item ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((it: any) => {
    const link = Array.isArray(it.link)
      ? (it.link.find((l: any) => !l['@rel'] || l['@rel'] === 'alternate') ?? it.link[0])['@href']
      : typeof it.link === 'object' ? it.link['@href'] : it.link;
    const published = it.pubDate ?? it.published ?? it.updated ?? it['dc:date'];
    return {
      id: asText(it.guid) || asText(it.id) || link,
      title: asText(it.title).trim(),
      url: link ? decode(String(link).trim()) : null,
      published: published ? new Date(asText(published) || published) : null,
    };
  }).filter((i) => i.id && i.title);
}

/** Turn what the user typed into a fetchable feed URL (null = not connectable yet). */
export async function resolveFeed(platform: Platform, input: string): Promise<{ handle: string; feedUrl: string | null }> {
  const v = input.trim();
  if (platform === 'twitter') return { handle: '@' + v.replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//, ''), feedUrl: null };
  if (platform === 'linkedin') return { handle: v, feedUrl: null };
  if (platform === 'reddit') {
    const m = v.match(/(?:reddit\.com\/)?(r|u|user)\/([\w-]+)/i);
    if (!m) throw new Error('Use r/subreddit or u/username.');
    const kind = m[1].toLowerCase() === 'r' ? 'r' : 'user';
    return { handle: `${kind === 'r' ? 'r' : 'u'}/${m[2]}`, feedUrl: `https://www.reddit.com/${kind}/${m[2]}/.rss` };
  }
  // News site: the URL itself if it's a feed, else the feed the page advertises, else /feed.
  const url = /^https?:\/\//.test(v) ? v : `https://${v}`;
  const page = await get(url);
  if (isFeed(page.text)) return { handle: url, feedUrl: page.url };
  const link = page.text.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i)?.[0];
  const href = link?.match(/href=["']([^"']+)["']/i)?.[1];
  if (href) return { handle: url, feedUrl: new URL(href, page.url).toString() };
  const guess = new URL('/feed', page.url).toString();
  if (isFeed((await get(guess)).text)) return { handle: url, feedUrl: guess };
  throw new Error('No RSS/Atom feed found on that site.');
}

/** Fetch feeds not checked in the last REFRESH_MINUTES; store new items. Errors are kept per account. */
export async function refreshStaleAccounts() {
  const supabase = getSupabaseServerClient();
  const cutoff = new Date(Date.now() - REFRESH_MINUTES * 60_000).toISOString();
  const { data: stale } = await supabase.from('tracked_accounts').select('*')
    .eq('active', true).not('feed_url', 'is', null)
    .or(`last_fetched_at.is.null,last_fetched_at.lt.${cutoff}`);
  await Promise.all(((stale || []) as Account[]).map(async (a) => {
    const now = new Date().toISOString();
    try {
      const items = parseFeed((await get(a.feed_url!)).text).slice(0, ITEMS_PER_FETCH);
      if (items.length) {
        await supabase.from('account_activity').upsert(
          items.map((i) => ({
            account_id: a.id, external_id: i.id.slice(0, 1000), title: i.title.slice(0, 500), url: i.url,
            published_at: i.published && !isNaN(i.published.getTime()) ? i.published.toISOString() : now,
          })),
          { onConflict: 'account_id,external_id', ignoreDuplicates: true },
        );
      }
      await supabase.from('tracked_accounts').update({ last_fetched_at: now, last_error: null }).eq('id', a.id);
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'Feed timed out' : String(e?.message || e).slice(0, 200);
      await supabase.from('tracked_accounts').update({ last_fetched_at: now, last_error: msg }).eq('id', a.id);
    }
  }));
}

export async function getAccounts() {
  const { data } = await getSupabaseServerClient().from('tracked_accounts').select('*')
    .eq('active', true).order('display_name');
  return (data || []) as Account[];
}

export async function getActivity(limit = 30) {
  const { data } = await getSupabaseServerClient().from('account_activity')
    .select('id, account_id, title, url, published_at, tracked_accounts(display_name, platform, handle_or_url)')
    .order('published_at', { ascending: false }).limit(limit);
  return (data || []) as unknown as Activity[];
}
