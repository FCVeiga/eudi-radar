'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { getChats, getThread, markChatRead, respondToRequest, sendMessage, startChat } from '@/app/social/actions';

type Person = { id: string; username: string; displayName: string; avatarUrl: string | null };
type Summary = { id: string; other: Person | null; myStatus: string; otherStatus: string; requestedByMe: boolean; last: { body: string; at: string; mine: boolean } | null; unread: number };
type Message = { id: string; body: string; at: string; mine: boolean };

const LIST_MS = 15_000;
const THREAD_MS = 4_000;

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Chats and chat requests: the list, a thread, and a new-chat composer.
 * The same panel runs in the navbar's pop-up window and on /chat.
 */
export default function ChatPanel({ variant, initialId, composeTo, onClose, onCountsChange }: {
  variant: 'popup' | 'page'; initialId?: string | null; composeTo?: string | null;
  onClose?: () => void; onCountsChange?: () => void;
}) {
  const [chats, setChats] = useState<Summary[] | null>(null);
  const [tab, setTab] = useState<'chats' | 'requests'>('chats');
  const [openId, setOpenId] = useState<string | null>(initialId ?? null);
  const [composing, setComposing] = useState<string | null>(composeTo ?? null);
  const [thread, setThread] = useState<{ summary: Summary; messages: Message[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => setChats(await getChats() as Summary[]), []);
  const loadThread = useCallback(async (id: string) => {
    const t = await getThread(id);
    setThread(t as any);
    if (t && (t as any).summary.myStatus === 'accepted' && (t as any).summary.unread) { await markChatRead(id); onCountsChange?.(); }
  }, [onCountsChange]);

  useEffect(() => { setComposing(composeTo ?? null); if (composeTo) setOpenId(null); }, [composeTo]);
  useEffect(() => { loadList(); const t = setInterval(loadList, LIST_MS); return () => clearInterval(t); }, [loadList]);
  useEffect(() => {
    if (!openId) { setThread(null); return; }
    loadThread(openId);
    const t = setInterval(() => loadThread(openId), THREAD_MS);
    return () => clearInterval(t);
  }, [openId, loadThread]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length]);

  const requests = (chats || []).filter((c) => c.myStatus === 'pending');
  const active = (chats || []).filter((c) => c.myStatus === 'accepted');
  const list = tab === 'requests' ? requests : active;

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true); setError(null);
    if (composing) {
      const r = await startChat(composing, text);
      if ('error' in r) setError(r.error);
      else { setDraft(''); setComposing(null); setOpenId(r.conversationId); await loadList(); }
    } else if (openId) {
      const r = await sendMessage(openId, text);
      if ('error' in r) setError(r.error ?? 'Could not send.');
      else { setDraft(''); await loadThread(openId); loadList(); }
    }
    setSending(false);
  }

  async function respond(accept: boolean) {
    if (!openId) return;
    await respondToRequest(openId, accept);
    onCountsChange?.();
    await loadList();
    if (accept) { setTab('chats'); await loadThread(openId); } else { setOpenId(null); }
  }

  const s = thread?.summary;
  const showThread = !!openId || !!composing;

  return (
    <div className={`chat-panel ${variant} ${showThread ? 'has-thread' : ''}`}>
      <div className="chat-list">
        <div className="chat-list-head">
          <strong>Chats</strong>
          <div className="chat-head-actions">
            {variant === 'popup' && <Link href="/chat" className="chat-icon-btn" title="Open the chat page" aria-label="Open the chat page">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 8 8M11.5 9.5v4h-9v-9h4" /></svg></Link>}
            {onClose && <button type="button" className="chat-icon-btn" onClick={onClose} aria-label="Close chat">×</button>}
          </div>
        </div>
        <div className="chat-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'chats'} className={tab === 'chats' ? 'on' : ''} onClick={() => setTab('chats')}>Chats</button>
          <button type="button" role="tab" aria-selected={tab === 'requests'} className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>
            Requests{requests.length > 0 && <span className="chat-badge">{requests.length}</span>}
          </button>
        </div>
        <ul className="chat-items">
          {chats === null && <li className="chat-empty">Loading…</li>}
          {chats !== null && list.length === 0 && (
            <li className="chat-empty">{tab === 'requests' ? 'No chat requests.' : 'No chats yet. Start one from someone’s profile.'}</li>
          )}
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" className={`chat-item ${openId === c.id ? 'on' : ''}`} onClick={() => { setComposing(null); setOpenId(c.id); }}>
                <UserAvatar name={c.other?.username || '?'} src={c.other?.avatarUrl} size={36} />
                <span className="chat-item-text">
                  <span className="chat-item-top"><strong>{c.other?.displayName ?? 'Deleted user'}</strong>{c.last && <em>{ago(c.last.at)}</em>}</span>
                  <span className="chat-item-last">
                    {c.myStatus === 'accepted' && c.otherStatus === 'pending' ? 'Request sent · ' : ''}
                    {c.last ? `${c.last.mine ? 'You: ' : ''}${c.last.body}` : ''}
                  </span>
                </span>
                {c.unread > 0 && c.myStatus === 'accepted' && <span className="chat-badge">{c.unread}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="chat-thread">
        {!showThread && <div className="chat-placeholder"><p>Select a chat, or start one from someone’s profile.</p></div>}
        {showThread && (
          <>
            <div className="chat-thread-head">
              <button type="button" className="chat-icon-btn chat-back" onClick={() => { setOpenId(null); setComposing(null); }} aria-label="Back to chats">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
              </button>
              {composing ? <strong>New chat with u/{composing}</strong> : s?.other ? (
                <Link href={`/u/${s.other.username}`} className="chat-thread-who">
                  <UserAvatar name={s.other.username} src={s.other.avatarUrl} size={28} />
                  <span><strong>{s.other.displayName}</strong><em>u/{s.other.username}</em></span>
                </Link>
              ) : <strong>Chat</strong>}
            </div>
            <div className="chat-messages">
              {composing && <p className="chat-note">Your first message is sent as a chat request — u/{composing} can accept or decline it.</p>}
              {(thread?.messages || []).map((m) => (
                <div key={m.id} className={`chat-msg ${m.mine ? 'mine' : ''}`}><p>{m.body}</p><time>{ago(m.at)}</time></div>
              ))}
              {s?.myStatus === 'accepted' && s.otherStatus === 'pending' && <p className="chat-note">Waiting for u/{s.other?.username} to accept your request.</p>}
              <div ref={bottom} />
            </div>
            {s?.myStatus === 'pending' ? (
              <div className="chat-request-actions">
                <p>u/{s.other?.username} wants to chat with you.</p>
                <div><button type="button" className="btn" onClick={() => respond(false)}>Decline</button><button type="button" className="btn primary" onClick={() => respond(true)}>Accept</button></div>
              </div>
            ) : (
              <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message" rows={1} maxLength={4000}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Message" />
                <button type="submit" className="chat-send" disabled={!draft.trim() || sending} aria-label="Send">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8 13.5 2.5 10 13.5 7.8 8.8z" /></svg>
                </button>
              </form>
            )}
            {error && <p className="form-msg err chat-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
