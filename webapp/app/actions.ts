'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase';
import { refreshStaleAccounts, resolveFeed } from '@/lib/accounts';
import { CATEGORIES, PLATFORMS, Platform } from '@/lib/platforms';

export type AddAccountState = { ok: boolean; message: string } | null;

export async function addAccount(_prev: AddAccountState, form: FormData): Promise<AddAccountState> {
  const platform = String(form.get('platform') || '') as Platform;
  const input = String(form.get('handle') || '').trim();
  const name = String(form.get('display_name') || '').trim();
  const category = String(form.get('category') || 'MEDIA');
  if (!(platform in PLATFORMS)) return { ok: false, message: 'Pick a platform.' };
  if (!input) return { ok: false, message: 'Enter a URL or handle.' };
  if (!(CATEGORIES as readonly string[]).includes(category)) return { ok: false, message: 'Pick a category.' };

  let resolved;
  try {
    resolved = await resolveFeed(platform, input);
  } catch (e: any) {
    return { ok: false, message: `Couldn't connect: ${e?.name === 'AbortError' ? 'the site took too long to answer' : e?.message || e}` };
  }

  const supabase = getSupabaseServerClient();
  const { data: dupe } = await supabase.from('tracked_accounts').select('id')
    .eq('platform', platform).eq('handle_or_url', resolved.handle).limit(1);
  if (dupe && dupe.length) return { ok: false, message: 'You already follow this account.' };

  const { error } = await supabase.from('tracked_accounts').insert({
    platform, handle_or_url: resolved.handle, display_name: name || resolved.handle,
    category, active: true, feed_url: resolved.feedUrl,
  });
  if (error) return { ok: false, message: error.message };

  if (resolved.feedUrl) await refreshStaleAccounts();  // first items show up straight away
  revalidatePath('/');
  return {
    ok: true,
    message: resolved.feedUrl
      ? `Following ${name || resolved.handle}.`
      : `Added ${name || resolved.handle}. ${PLATFORMS[platform].label} needs API access before its activity can show.`,
  };
}
