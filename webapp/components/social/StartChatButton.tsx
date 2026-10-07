'use client';

import { openChat } from './NavActions';
import { useT } from '@/lib/i18n/client';

/** Profile: open the chat window with a new chat request to this user. */
export default function StartChatButton({ username }: { username: string }) {
  const t = useT();
  return (
    <button type="button" className="btn primary" onClick={() => openChat(username)}>
      <svg className="btn-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5h13v8.6h-7.2L5.6 16v-2.9H3.5z" /></svg>
      {t('Start chat')}
    </button>
  );
}
