'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import NotificationIcon from './NotificationIcon';
import { markNotificationsRead, setNotificationPref } from '@/app/social/actions';

type Note = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string; actor: { username: string; avatarUrl: string | null } | null };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  if (m < 43200) return `${Math.round(m / 1440)}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** The notifications list: unread highlighted; click opens it and marks it read. */
export function NotificationList({ notes }: { notes: Note[] }) {
  const [read, setRead] = useState<Set<string>>(new Set(notes.filter((n) => n.read).map((n) => n.id)));
  const [, start] = useTransition();
  const router = useRouter();
  const unread = notes.filter((n) => !read.has(n.id)).length;
  return (
    <>
      <div className="np-toolbar">
        <span className="muted">{unread ? `${unread} unread` : 'All caught up'}</span>
        {unread > 0 && <button type="button" className="btn" onClick={() => { setRead(new Set(notes.map((n) => n.id))); start(async () => { await markNotificationsRead(); router.refresh(); }); }}>Mark all as read</button>}
      </div>
      {notes.length === 0 ? (
        <div className="profile-empty"><p className="profile-empty-title">No notifications here yet</p><p className="muted">Likes and comments on your posts and comments, and new tenders for your search scope, show up here.</p></div>
      ) : (
        <ul className="np-list">
          {notes.map((n) => {
            const isRead = read.has(n.id);
            return (
              <li key={n.id}>
                <button type="button" className={`np-item ${isRead ? '' : 'unread'}`} onClick={() => {
                  if (!isRead) { setRead(new Set([...Array.from(read), n.id])); start(() => markNotificationsRead([n.id])); }
                  if (n.link) router.push(n.link);
                }}>
                  <NotificationIcon type={n.type} actor={n.actor} size={40} />
                  <span className="np-text"><strong>{n.title}</strong>{n.body && <em>{n.body}</em>}</span>
                  <time>{ago(n.createdAt)}</time>
                  {!isRead && <span className="np-dot" aria-label="unread" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const PREFS: [string, string, string][] = [
  ['likes', 'Likes', 'On your posts and comments'],
  ['comments', 'Comments', 'On your posts'],
  ['replies', 'Replies', 'To your comments'],
  ['new_tender', 'New tenders', 'Open tenders matching the Search Agent’s scope'],
  ['tender_update', 'Tender updates', 'Deadline changes and clarifications on tenders you follow'],
  ['follows', 'New followers', 'When someone follows you'],
];

/** Which notifications to receive (saved as you switch). */
export function NotificationSettings({ prefs }: { prefs: Record<string, boolean> }) {
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(PREFS.map(([k]) => [k, prefs[k] !== false])));
  const [, start] = useTransition();
  return (
    <div className="np-settings">
      <h3>Notify me about</h3>
      {PREFS.map(([key, label, hint]) => (
        <div key={key} className="np-pref">
          <span><strong>{label}</strong><em>{hint}</em></span>
          <button type="button" role="switch" aria-checked={on[key]} aria-label={label} className={`switch ${on[key] ? 'on' : ''}`}
            onClick={() => { const next = !on[key]; setOn({ ...on, [key]: next }); start(() => setNotificationPref(key, next)); }}><span /></button>
        </div>
      ))}
      <p className="field-hint">Chat requests always notify you.</p>
    </div>
  );
}
