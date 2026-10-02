import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ChatPanel from '@/components/social/ChatPanel';

export const metadata = { title: 'Chat — EUDI Radar' };

export default async function ChatPage({ searchParams }: { searchParams: { c?: string } }) {
  if (!(await getCurrentUser())) redirect('/login?next=/chat');
  const id = searchParams.c && /^[0-9a-f-]{36}$/.test(searchParams.c) ? searchParams.c : null;
  return (
    <div className="chat-page">
      <h1 className="opps-h1">Chat</h1>
      <ChatPanel variant="page" initialId={id} />
    </div>
  );
}
