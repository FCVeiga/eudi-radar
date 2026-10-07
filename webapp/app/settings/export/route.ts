import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** Settings → "Download your data": everything you've put on the platform, as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: (await getT())('Log in first.') }, { status: 401 });
  const db = getSupabaseServerClient();
  const mine = (table: string, cols = '*') => db.from(table).select(cols).eq('user_id', user.id).then((r) => r.data ?? []);
  const [profile, account, posts, comments, likes, workspaces, messages, notifications, following] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).maybeSingle().then((r) => r.data),
    db.from('accounts').select('plan, plan_status, current_period_end, created_at').eq('kind', 'personal').eq('owner_id', user.id).maybeSingle().then((r) => r.data),
    mine('posts'), mine('comments'), mine('likes'),
    db.from('workspace_members').select('role, created_at, workspaces(name)').eq('user_id', user.id).then((r) => r.data ?? []),
    db.from('messages').select('conversation_id, body, created_at').eq('sender_id', user.id).then((r) => r.data ?? []),
    mine('notifications', 'type, title, body, link, read_at, created_at'),
    db.from('user_follows').select('followee_id, created_at').eq('follower_id', user.id).then((r) => r.data ?? []),
  ]);
  const body = JSON.stringify({
    exported_at: new Date().toISOString(), email: user.email, profile, plan: account, workspaces,
    posts, comments, likes, people_followed: following, messages_sent: messages, notifications,
  }, null, 2);
  return new NextResponse(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="eudi-radar-${user.username}-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    },
  });
}
