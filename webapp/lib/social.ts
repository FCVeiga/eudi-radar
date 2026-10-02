/**
 * The social layer, server-side: notifications (the bell), chat (requests and
 * threads — the chat bubble, the pop-up window and /chat) and posts with
 * comments. All access goes through the signed-in user's id.
 */
import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase';

export type Person = { id: string; username: string; displayName: string; avatarUrl: string | null };
export type Notification = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string; actor: Person | null };
export type ChatSummary = {
  id: string; other: Person | null; myStatus: string; otherStatus: string; requestedByMe: boolean;
  last: { body: string; at: string; mine: boolean } | null; unread: number;
};
export type ChatMessage = { id: string; body: string; at: string; mine: boolean };

const db = () => getSupabaseServerClient();

async function people(ids: string[]): Promise<Map<string, Person>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();
  const { data } = await db().from('profiles').select('id, username, display_name, avatar_url').in('id', unique);
  return new Map((data || []).map((p: any) => [p.id, { id: p.id, username: p.username, displayName: p.display_name || p.username, avatarUrl: p.avatar_url }]));
}

export async function notify(userId: string, n: { type: string; title: string; body?: string | null; link?: string | null; actorId?: string | null }) {
  await db().from('notifications').insert({ user_id: userId, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, actor_id: n.actorId ?? null });
}

/* ---------------- Notifications ---------------- */

export async function listNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const { data } = await db().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  const who = await people((data || []).map((n: any) => n.actor_id));
  return (data || []).map((n: any) => ({
    id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.read_at, createdAt: n.created_at,
    actor: n.actor_id ? who.get(n.actor_id) ?? null : null,
  }));
}

/** Badge numbers for the navbar: unread notifications, and chat requests + unread messages. */
export async function counts(userId: string) {
  const [{ count: notes }, chats] = await Promise.all([
    db().from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
    chatOverview(userId),
  ]);
  const chat = chats.filter((c) => c.myStatus === 'pending').length + chats.filter((c) => c.myStatus === 'accepted').reduce((n, c) => n + c.unread, 0);
  return { notifications: notes ?? 0, chat };
}

/* ---------------- Chat ---------------- */

/** Every conversation of the user (declined ones left out), newest activity first. */
export async function chatOverview(userId: string): Promise<ChatSummary[]> {
  const { data: mine } = await db().from('conversation_members').select('conversation_id, status, last_read_at').eq('user_id', userId).neq('status', 'declined');
  const ids = (mine || []).map((m: any) => m.conversation_id);
  if (!ids.length) return [];
  const [{ data: members }, { data: convs }, { data: msgs }] = await Promise.all([
    db().from('conversation_members').select('conversation_id, user_id, status').in('conversation_id', ids).neq('user_id', userId),
    db().from('conversations').select('id, created_by, last_message_at').in('id', ids),
    db().from('messages').select('conversation_id, sender_id, body, created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(500),
  ]);
  const who = await people((members || []).map((m: any) => m.user_id));
  return (convs || []).map((c: any): ChatSummary => {
    const me = (mine || []).find((m: any) => m.conversation_id === c.id);
    const other = (members || []).find((m: any) => m.conversation_id === c.id);
    const thread = (msgs || []).filter((m: any) => m.conversation_id === c.id);
    const lastRead = me?.last_read_at ? new Date(me.last_read_at).getTime() : 0;
    return {
      id: c.id, other: other ? who.get(other.user_id) ?? null : null, myStatus: me?.status, otherStatus: other?.status ?? 'accepted',
      requestedByMe: c.created_by === userId,
      last: thread[0] ? { body: thread[0].body, at: thread[0].created_at, mine: thread[0].sender_id === userId } : null,
      unread: thread.filter((m: any) => m.sender_id !== userId && new Date(m.created_at).getTime() > lastRead).length,
    };
  }).sort((a, b) => new Date(b.last?.at ?? 0).getTime() - new Date(a.last?.at ?? 0).getTime());
}

export async function membership(conversationId: string, userId: string) {
  const { data } = await db().from('conversation_members').select('status').eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle();
  return data?.status as string | undefined;
}

export async function thread(conversationId: string, userId: string): Promise<{ summary: ChatSummary; messages: ChatMessage[] } | null> {
  if (!(await membership(conversationId, userId))) return null;
  const summary = (await chatOverview(userId)).find((c) => c.id === conversationId);
  if (!summary) return null;
  const { data } = await db().from('messages').select('id, sender_id, body, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(300);
  return { summary, messages: (data || []).map((m: any) => ({ id: m.id, body: m.body, at: m.created_at, mine: m.sender_id === userId })) };
}

/** An existing one-to-one conversation between two users, if any. */
export async function findConversation(a: string, b: string) {
  const { data: mine } = await db().from('conversation_members').select('conversation_id').eq('user_id', a);
  const ids = (mine || []).map((m: any) => m.conversation_id);
  if (!ids.length) return null;
  const { data } = await db().from('conversation_members').select('conversation_id, status').eq('user_id', b).in('conversation_id', ids).limit(1);
  return data?.[0] ?? null;
}

/* ---------------- Posts ---------------- */

export async function getPost(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data: post } = await db().from('posts').select('*').eq('id', id).maybeSingle();
  if (!post) return null;
  const { data: comments } = await db().from('comments').select('id, user_id, body, score, created_at').eq('post_id', id).order('created_at', { ascending: true });
  const who = await people([post.user_id, ...(comments || []).map((c: any) => c.user_id)]);
  let item: { href: string; title: string; kind: string } | null = null;
  if (post.item_type && post.item_id) {
    const table = post.item_type === 'tender' ? 'opportunities' : 'news_items';
    const key = post.item_type === 'tender' ? 'opportunity_id' : 'news_id';
    const { data } = await db().from(table).select('title, title_en').eq(key, post.item_id).maybeSingle();
    if (data) item = { href: `/${post.item_type === 'tender' ? 'tenders' : 'news'}/${post.item_id}`, title: data.title_en || data.title, kind: post.item_type === 'tender' ? 'Tender' : 'News' };
  }
  return {
    id: post.id, title: post.title, body: post.body, score: post.score, createdAt: post.created_at, author: who.get(post.user_id) ?? null, authorId: post.user_id,
    item, comments: (comments || []).map((c: any) => ({ id: c.id, body: c.body, score: c.score, createdAt: c.created_at, author: who.get(c.user_id) ?? null })),
  };
}
