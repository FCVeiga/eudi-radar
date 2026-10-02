'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import ChatPanel from './ChatPanel';
import { getCounts, getNotifications, markNotificationsRead } from '@/app/social/actions';

type Note = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string; actor: { username: string; avatarUrl: string | null } | null };
const COUNTS_MS = 20_000;

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

/** Opens the chat window from anywhere (e.g. "Start chat" on a profile). */
export function openChat(username?: string) {
  window.dispatchEvent(new CustomEvent('eudi:open-chat', { detail: { username } }));
}

/** Navbar, signed in: notifications bell, + New Post, chat bubble (opens the chat window). */
export default function NavActions() {
  const [count, setCount] = useState({ notifications: 0, chat: 0 });
  const [bellOpen, setBellOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [composeTo, setComposeTo] = useState<string | null>(null);
  const bell = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => setCount(await getCounts()), []);
  useEffect(() => { refresh(); const t = setInterval(refresh, COUNTS_MS); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { setBellOpen(false); }, [path]);
  useEffect(() => {
    const open = (e: Event) => { setComposeTo((e as CustomEvent).detail?.username ?? null); setChatOpen(true); };
    window.addEventListener('eudi:open-chat', open);
    return () => window.removeEventListener('eudi:open-chat', open);
  }, []);
  useEffect(() => {
    if (!bellOpen) return;
    const down = (e: MouseEvent) => { if (!bell.current?.contains(e.target as Node)) setBellOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setBellOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [bellOpen]);

  async function toggleBell() {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) {
      setNotes(await getNotifications() as Note[]);
      if (count.notifications) { await markNotificationsRead(); refresh(); }
    }
  }

  const onChatPage = path === '/chat';

  return (
    <div className="nav-actions">
      <div className="nav-bell" ref={bell}>
        <button type="button" className="nav-icon" aria-label={`Notifications${count.notifications ? ` (${count.notifications} new)` : ''}`} aria-expanded={bellOpen} onClick={toggleBell}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8a4.6 4.6 0 0 0-4.6 4.6v2.7L4 12.9h12l-1.4-2.8V7.4A4.6 4.6 0 0 0 10 2.8zM8.2 15.6a1.9 1.9 0 0 0 3.6 0" /></svg>
          {count.notifications > 0 && <span className="nav-badge">{count.notifications > 9 ? '9+' : count.notifications}</span>}
        </button>
        {bellOpen && (
          <div className="notes-menu" role="dialog" aria-label="Notifications">
            <div className="notes-head"><strong>Notifications</strong></div>
            <ul>
              {notes === null && <li className="notes-empty">Loading…</li>}
              {notes?.length === 0 && <li className="notes-empty">You’re all caught up. Follow tenders with the heart to hear about their updates.</li>}
              {notes?.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`note ${n.read ? '' : 'unread'}`}
                    onClick={() => { setBellOpen(false); if (n.link?.startsWith('/chat')) { setComposeTo(null); setChatOpen(true); } else if (n.link) router.push(n.link); }}>
                    {n.actor ? <UserAvatar name={n.actor.username} src={n.actor.avatarUrl} size={32} />
                      : <span className="note-icon" aria-hidden="true">{n.type === 'tender_update' ? '📌' : '🔔'}</span>}
                    <span className="note-text"><strong>{n.title}</strong>{n.body && <em>{n.body}</em>}</span>
                    <time>{ago(n.createdAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Link href="/posts/new" className="btn nav-new-post" aria-label="Create a new post">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
        <span>New Post</span>
      </Link>

      <button type="button" className="nav-icon" aria-label={`Chat${count.chat ? ` (${count.chat} new)` : ''}`}
        onClick={() => { if (onChatPage) return; setComposeTo(null); setChatOpen(!chatOpen); }}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5h13v8.6h-7.2L5.6 16v-2.9H3.5z" /><path d="M7 8.8h.01M10 8.8h.01M13 8.8h.01" /></svg>
        {count.chat > 0 && <span className="nav-badge">{count.chat > 9 ? '9+' : count.chat}</span>}
      </button>

      {chatOpen && !onChatPage && (
        <div className="chat-popup" role="dialog" aria-label="Chat">
          <ChatPanel variant="popup" composeTo={composeTo} onClose={() => setChatOpen(false)} onCountsChange={refresh} />
        </div>
      )}
    </div>
  );
}
