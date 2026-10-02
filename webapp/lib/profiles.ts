/** Profile rows for accounts (server-only helpers, not server actions). */
import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase';
import { USERNAME } from '@/lib/auth';

export async function usernameTaken(username: string, exceptId?: string) {
  const { data } = await getSupabaseServerClient().from('profiles').select('id').ilike('username', username.replace(/[\\%_]/g, (c) => `\\${c}`)).maybeSingle();
  return !!data && data.id !== exceptId;
}

/** A free username from an email address or name (for Google sign-ups). */
async function freeUsername(seed: string) {
  const base = (seed.normalize('NFKD').replace(/[^\w]/g, '').slice(0, 18) || 'user').padEnd(3, '0');
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
    if (!(await usernameTaken(candidate))) return candidate;
  }
  return `user${Date.now().toString(36)}`;
}

/** Profile row for a new account (email sign-up or Google). */
export async function ensureProfile(userId: string, email: string, meta: Record<string, any> = {}) {
  const db = getSupabaseServerClient();
  const { data } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (data) return;
  const username = meta.username && USERNAME.test(meta.username) && !(await usernameTaken(meta.username))
    ? meta.username : await freeUsername(meta.username || meta.full_name || email.split('@')[0]);
  await db.from('profiles').insert({
    id: userId, username, display_name: meta.full_name || meta.name || username, avatar_url: meta.avatar_url || meta.picture || null,
  });
}

