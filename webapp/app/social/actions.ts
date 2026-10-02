'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { chatOverview, counts, findConversation, listNotifications, membership, notify, thread } from '@/lib/social';

export type FormState = { ok: boolean; message: string } | null;
const db = () => getSupabaseServerClient();
const UUID = /^[0-9a-f-]{36}$/;

/* ---------------- Navbar ---------------- */

export async function getCounts() {
  const user = await getCurrentUser();
  return user ? counts(user.id) : { notifications: 0, chat: 0 };
}

export async function getNotifications() {
  const user = await getCurrentUser();
  return user ? listNotifications(user.id) : [];
}

export async function markNotificationsRead(ids?: string[]) {
  const user = await getCurrentUser();
  if (!user) return;
  let q = db().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
  if (ids?.length) q = q.in('id', ids.filter((i) => UUID.test(i)));
  await q;
}

/* ---------------- Posts ---------------- */

const MEDIA = /\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i;

/** Post media: a one-time upload URL in the public 'post-media' bucket (images and videos, up to 50 MB). */
export async function createPostMediaUpload(filename: string, size: number) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Log in to post.' };
  const ext = filename.match(MEDIA)?.[1]?.toLowerCase();
  if (!ext) return { error: 'Use PNG, JPG, WebP, GIF, MP4, WebM or MOV files.' };
  if (size > 50 * 1024 * 1024) return { error: 'Files up to 50 MB.' };
  const path = `${user.id}/${crypto.randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const { data, error } = await db().storage.from('post-media').createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message || 'Could not start the upload.' };
  return { path, url: data.signedUrl, publicUrl: db().storage.from('post-media').getPublicUrl(path).data.publicUrl,
           type: /^(mp4|webm|mov)$/.test(ext) ? 'video' as const : 'image' as const };
}

export async function createPost(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Log in to post.' };
  const title = String(form.get('title') || '').trim();
  const body = String(form.get('body') || '').trim();
  if (title.length < 3) return { ok: false, message: 'Give your post a title.' };
  if (title.length > 300) return { ok: false, message: 'Titles are up to 300 characters.' };
  let tags: string[] = [];
  let media: { type: string; url: string; path: string }[] = [];
  try {
    tags = (JSON.parse(String(form.get('tags') || '[]')) as unknown[]).map((t) => String(t).trim().toLowerCase().slice(0, 50)).filter(Boolean);
    media = (JSON.parse(String(form.get('media') || '[]')) as any[]).filter((m) =>
      (m?.type === 'image' || m?.type === 'video') && typeof m.path === 'string' && m.path.startsWith(`${user.id}/`)).slice(0, 10);
  } catch { return { ok: false, message: 'Something went wrong with the tags or media — try again.' }; }
  const bucket = db().storage.from('post-media');
  const { data, error } = await db().from('posts').insert({
    user_id: user.id, title, body: body.slice(0, 40000) || null, tags: Array.from(new Set(tags)).slice(0, 10),
    media: media.map((m) => ({ type: m.type, path: m.path, url: bucket.getPublicUrl(m.path).data.publicUrl })),
  }).select('id').single();
  if (error || !data) return { ok: false, message: error?.message || 'Could not publish the post.' };
  revalidatePath('/community');
  revalidatePath(`/u/${user.username}`);
  redirect(`/posts/${data.id}`);
}

/** Follow / unfollow a member: their posts rank higher in your Community Feed. */
export async function toggleFollow(username: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'login' as const };
  const { data: target } = await db().from('profiles').select('id, username').ilike('username', username.replace(/_/g, '\\_')).maybeSingle();
  if (!target || target.id === user.id) return { error: 'invalid' as const };
  const key = { follower_id: user.id, followee_id: target.id };
  const { data } = await db().from('user_follows').select('followee_id').match(key).maybeSingle();
  if (data) await db().from('user_follows').delete().match(key);
  else {
    await db().from('user_follows').insert(key);
    await notify(target.id, { type: 'follow', title: `u/${user.username} started following you`, link: `/u/${user.username}`, actorId: user.id });
  }
  revalidatePath(`/u/${target.username}`);
  return { following: !data };
}

export async function addComment(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Log in to comment.' };
  const postId = String(form.get('post') || '');
  const body = String(form.get('body') || '').trim();
  if (!UUID.test(postId) || !body) return { ok: false, message: 'Write a comment first.' };
  const { data: post } = await db().from('posts').select('user_id, title').eq('id', postId).maybeSingle();
  if (!post) return { ok: false, message: 'That post no longer exists.' };
  const { error } = await db().from('comments').insert({ user_id: user.id, post_id: postId, body: body.slice(0, 10000) });
  if (error) return { ok: false, message: error.message };
  if (post.user_id !== user.id) {
    await notify(post.user_id, { type: 'comment', title: `u/${user.username} commented on your post`, body: post.title, link: `/posts/${postId}`, actorId: user.id });
  }
  revalidatePath(`/posts/${postId}`);
  return { ok: true, message: 'Comment posted.' };
}

/* ---------------- Chat ---------------- */

export async function getChats() {
  const user = await getCurrentUser();
  return user ? chatOverview(user.id) : [];
}

export async function getThread(conversationId: string) {
  const user = await getCurrentUser();
  if (!user || !UUID.test(conversationId)) return null;
  return thread(conversationId, user.id);
}

/** A chat request: a new conversation the other person accepts or declines (one per pair). */
export async function startChat(username: string, body: string): Promise<{ error: string } | { conversationId: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Log in to chat.' };
  const text = body.trim();
  if (!text) return { error: 'Write a first message.' };
  const { data: target } = await db().from('profiles').select('id, username').ilike('username', username.replace(/_/g, '\\_')).maybeSingle();
  if (!target) return { error: 'No such user.' };
  if (target.id === user.id) return { error: 'That’s you.' };
  const existing = await findConversation(user.id, target.id);
  if (existing) {
    if (existing.status === 'declined') return { error: `u/${target.username} declined your chat request.` };
    const sent = await sendMessage(existing.conversation_id, text);
    return 'error' in sent && sent.error ? { error: sent.error } : { conversationId: existing.conversation_id };
  }
  const { data: conv, error } = await db().from('conversations').insert({ created_by: user.id }).select('id').single();
  if (error || !conv) return { error: error?.message || 'Could not start the chat.' };
  await db().from('conversation_members').insert([
    { conversation_id: conv.id, user_id: user.id, status: 'accepted', last_read_at: new Date().toISOString() },
    { conversation_id: conv.id, user_id: target.id, status: 'pending' },
  ]);
  await db().from('messages').insert({ conversation_id: conv.id, sender_id: user.id, body: text.slice(0, 4000) });
  await notify(target.id, { type: 'chat_request', title: `u/${user.username} wants to chat`, body: text.slice(0, 200), link: `/chat?c=${conv.id}`, actorId: user.id });
  return { conversationId: conv.id };
}

export async function respondToRequest(conversationId: string, accept: boolean) {
  const user = await getCurrentUser();
  if (!user || !UUID.test(conversationId) || (await membership(conversationId, user.id)) !== 'pending') return { error: 'not allowed' };
  await db().from('conversation_members').update({ status: accept ? 'accepted' : 'declined', last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).eq('user_id', user.id);
  if (accept) {
    const { data: conv } = await db().from('conversations').select('created_by').eq('id', conversationId).maybeSingle();
    if (conv?.created_by) await notify(conv.created_by, { type: 'chat_accepted', title: `u/${user.username} accepted your chat request`, link: `/chat?c=${conversationId}`, actorId: user.id });
  }
  return { ok: true };
}

export async function sendMessage(conversationId: string, body: string) {
  const user = await getCurrentUser();
  if (!user || !UUID.test(conversationId)) return { error: 'Log in to chat.' };
  const text = body.trim().slice(0, 4000);
  if (!text) return { error: 'Empty message.' };
  if ((await membership(conversationId, user.id)) !== 'accepted') return { error: 'Accept the chat request first.' };
  const { data: other } = await db().from('conversation_members').select('status').eq('conversation_id', conversationId).neq('user_id', user.id).maybeSingle();
  if (other?.status === 'declined') return { error: 'This chat request was declined.' };
  const now = new Date().toISOString();
  const { error } = await db().from('messages').insert({ conversation_id: conversationId, sender_id: user.id, body: text });
  if (error) return { error: error.message };
  await Promise.all([
    db().from('conversations').update({ last_message_at: now }).eq('id', conversationId),
    db().from('conversation_members').update({ last_read_at: now }).eq('conversation_id', conversationId).eq('user_id', user.id),
  ]);
  return { ok: true };
}

export async function markChatRead(conversationId: string) {
  const user = await getCurrentUser();
  if (!user || !UUID.test(conversationId)) return;
  await db().from('conversation_members').update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).eq('user_id', user.id).eq('status', 'accepted');
}
