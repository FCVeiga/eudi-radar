/**
 * Accounts — Supabase Auth, entirely server-side. The browser only holds the
 * session cookies (httpOnly, set by @supabase/ssr); every sign-in, sign-up
 * and token refresh goes through server actions, route handlers and the
 * middleware. The key used here never reaches the client.
 */
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getActor } from '@/lib/actor';

export type CurrentUser = {
  id: string; email: string; username: string; displayName: string; avatarUrl: string | null;
  bio: string | null; createdAt: string;
};

/** Supabase client bound to this request's session cookies. */
export function authClient() {
  const store = cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server components can't set cookies (the middleware refreshes them instead).
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only here */ }
      },
    },
    auth: { flowType: 'pkce' },
  });
}

/** The signed-in user with their profile, or null. Once per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const actor = getActor();
  if (actor) return actor.user;
  if (!cookies().getAll().some((c) => c.name.startsWith('sb-'))) return null;
  const { data: { user } } = await authClient().auth.getUser();
  if (!user) return null;
  const { data: p } = await getSupabaseServerClient().from('profiles')
    .select('username, display_name, avatar_url, bio, created_at').eq('id', user.id).maybeSingle();
  const fallback = (user.email || 'user').split('@')[0];
  return {
    id: user.id, email: user.email || '', username: p?.username || fallback,
    displayName: p?.display_name || p?.username || fallback, avatarUrl: p?.avatar_url || null,
    bio: p?.bio || null, createdAt: p?.created_at || user.created_at,
  };
});

/** Public production origin. Preview hosts and localhost keep their own. */
export const PRODUCTION_ORIGIN = 'https://tendertown.io';

const CANONICAL_HOSTS = new Set([
  'tendertown.io',
  'www.tendertown.io',
  'tender-town.vercel.app',
  'eudi-radar.vercel.app',
]);

/** This site's origin, for auth redirect links, canonicals and agent URLs. */
export function siteOrigin() {
  const h = headers();
  const host = (h.get('x-forwarded-host') || h.get('host') || 'localhost:3000').split(',')[0].trim();
  const hostname = host.split(':')[0].toLowerCase();
  if (CANONICAL_HOSTS.has(hostname)) return PRODUCTION_ORIGIN;
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Only same-site paths as post-login destinations. */
export function safeNext(next: unknown, fallback = '/') {
  const n = String(next || '');
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : fallback;
}

export const USERNAME = /^[A-Za-z0-9_]{3,24}$/;
