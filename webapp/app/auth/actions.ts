'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase';
import { USERNAME, authClient, getCurrentUser, safeNext, siteOrigin } from '@/lib/auth';
import { ensureProfile, usernameTaken } from '@/lib/profiles';

export type AuthState = { ok: boolean; message: string } | null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const username = String(form.get('username') || '').trim();
  if (!EMAIL.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  if (!USERNAME.test(username)) return { ok: false, message: 'Usernames are 3–24 letters, numbers or underscores.' };
  if (password.length < 8) return { ok: false, message: 'Use a password of at least 8 characters.' };
  if (password !== String(form.get('confirm') || '')) return { ok: false, message: 'The passwords don’t match.' };
  if (await usernameTaken(username)) return { ok: false, message: `u/${username} is taken — try another.` };

  // Created confirmed: email verification needs an email provider on Supabase (see Help).
  const { data, error } = await getSupabaseServerClient().auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username },
  });
  if (error || !data.user) {
    return { ok: false, message: /already|registered|exists/i.test(error?.message || '') ? 'An account with this email already exists — log in instead.' : error?.message || 'Could not create the account.' };
  }
  await ensureProfile(data.user.id, email, { username });
  const { error: loginError } = await authClient().auth.signInWithPassword({ email, password });
  if (loginError) return { ok: false, message: 'Account created — please log in.' };
  redirect(safeNext(form.get('next'), `/u/${username}`));
}

export async function logIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  if (!email || !password) return { ok: false, message: 'Enter your email and password.' };
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, message: 'Wrong email or password.' };
  await ensureProfile(data.user.id, email, data.user.user_metadata);
  redirect(safeNext(form.get('next')));
}

/** "Continue with Google": ready for when the Google provider is enabled on Supabase. */
export async function continueWithGoogle(next?: string): Promise<AuthState> {
  const settings = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY! }, cache: 'no-store',
  }).then((r) => r.json()).catch(() => null);
  if (!settings?.external?.google) return { ok: false, message: 'Google sign-in is coming soon — use email and password for now.' };
  const { data, error } = await authClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error || !data.url) return { ok: false, message: error?.message || 'Could not reach Google.' };
  redirect(data.url);
}

export async function logOut() {
  await authClient().auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  await authClient().auth.resetPasswordForEmail(email, { redirectTo: `${siteOrigin()}/auth/callback?next=/reset-password` });
  // Same answer either way, so the form doesn't reveal who has an account.
  return { ok: true, message: 'If an account exists for that email, a reset link is on its way.' };
}

export async function updatePassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Your session expired — log in again.' };
  const password = String(form.get('password') || '');
  if (password.length < 8) return { ok: false, message: 'Use a password of at least 8 characters.' };
  if (password !== String(form.get('confirm') || '')) return { ok: false, message: 'The passwords don’t match.' };
  const { error } = await authClient().auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };
  if (form.get('then') === 'home') redirect('/');
  return { ok: true, message: 'Password changed.' };
}

export async function updateProfile(_prev: AuthState, form: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Your session expired — log in again.' };
  const username = String(form.get('username') || '').trim();
  const displayName = String(form.get('display_name') || '').trim().slice(0, 60);
  const bio = String(form.get('bio') || '').trim().slice(0, 1000);
  if (!USERNAME.test(username)) return { ok: false, message: 'Usernames are 3–24 letters, numbers or underscores.' };
  if (await usernameTaken(username, user.id)) return { ok: false, message: `u/${username} is taken.` };
  const { error } = await getSupabaseServerClient().from('profiles').update({
    username, display_name: displayName || username, bio: bio || null, updated_at: new Date().toISOString(),
  }).eq('id', user.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Profile saved.' };
}

/** Avatar: a one-time upload URL in the public 'avatars' bucket, then saved on the profile. */
export async function createAvatarUpload(filename: string, size: number) {
  const user = await getCurrentUser();
  if (!user) return { error: 'log in first' };
  const ext = (filename.match(/\.(png|jpe?g|webp|gif)$/i)?.[1] || '').toLowerCase();
  if (!ext) return { error: 'use a PNG, JPG, WebP or GIF image' };
  if (size > 5 * 1024 * 1024) return { error: 'images up to 5 MB' };
  const path = `${user.id}/${crypto.randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const { data, error } = await getSupabaseServerClient().storage.from('avatars').createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message || 'could not start the upload' };
  return { path, url: data.signedUrl };
}

export async function setAvatar(path: string) {
  const user = await getCurrentUser();
  if (!user || !path.startsWith(`${user.id}/`)) return { error: 'not allowed' };
  const db = getSupabaseServerClient();
  const { data } = db.storage.from('avatars').getPublicUrl(path);
  const old = user.avatarUrl?.split('/avatars/')[1];
  await db.from('profiles').update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
  if (old && old.startsWith(`${user.id}/`)) await db.storage.from('avatars').remove([old]);
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Deletes the account and everything tied to it (profile, likes, posts, comments, avatar). */
export async function deleteAccount(_prev: AuthState, form: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Your session expired — log in again.' };
  if (String(form.get('confirm') || '').trim() !== user.username) return { ok: false, message: `Type ${user.username} to confirm.` };
  const db = getSupabaseServerClient();
  const { data: files } = await db.storage.from('avatars').list(user.id);
  if (files?.length) await db.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, message: error.message };
  await authClient().auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

/** Heart on a tender or news story: like / unlike. Liked items show under Following on the profile. */
export async function toggleLike(itemType: 'tender' | 'news', itemId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'login' as const };
  if (!['tender', 'news'].includes(itemType) || !/^[\w-]{6,64}$/.test(itemId)) return { error: 'invalid' as const };
  const db = getSupabaseServerClient();
  const key = { user_id: user.id, item_type: itemType, item_id: itemId };
  const { data } = await db.from('likes').select('item_id').match(key).maybeSingle();
  if (data) await db.from('likes').delete().match(key);
  else await db.from('likes').insert(key);
  revalidatePath(`/u/${user.username}`);
  return { liked: !data };
}
