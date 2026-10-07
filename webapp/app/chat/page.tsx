import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ChatPanel from '@/components/social/ChatPanel';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t('Chat')} — EUDI Radar` };
}

export default async function ChatPage({ searchParams }: { searchParams: { c?: string } }) {
  if (!(await getCurrentUser())) redirect('/login?next=/chat');
  const t = await getT();
  const id = searchParams.c && /^[0-9a-f-]{36}$/.test(searchParams.c) ? searchParams.c : null;
  return (
    <div className="chat-page">
      <h1 className="opps-h1">{t('Chat')}</h1>
      <ChatPanel variant="page" initialId={id} />
    </div>
  );
}
