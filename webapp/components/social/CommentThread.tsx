'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import UserAvatar from '@/components/UserAvatar';
import HeartButton from '@/components/HeartButton';
import CardMenu from './CardMenu';
import { FormState, addComment } from '@/app/social/actions';
import { useLocale, useT } from '@/lib/i18n/client';

export type CommentNode = {
  id: string; body: string; createdAt: string; likes: number; liked: boolean;
  author: { username: string; avatarUrl: string | null } | null; replies: CommentNode[];
};

function ago(iso: string, t: ReturnType<typeof useT>, locale: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return t('{n}m ago', { n: Math.max(1, m) });
  if (m < 1440) return t('{n}h ago', { n: Math.round(m / 60) });
  if (m < 43200) return t('{n}d ago', { n: Math.round(m / 1440) });
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? t('Posting…') : label}</button>;
}

/** Comment box: on the item (no parent) or a reply to a comment. */
export function CommentForm({ item, parent, autoFocus, onDone, placeholder }: {
  item: string; parent?: string; autoFocus?: boolean; onDone?: () => void; placeholder?: string;
}) {
  const t = useT();
  const [state, action] = useFormState<FormState, FormData>(addComment, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) { form.current?.reset(); onDone?.(); } }, [state]);  // eslint-disable-line react-hooks/exhaustive-deps
  if (placeholder === undefined) placeholder = t('Add a comment');
  return (
    <form ref={form} action={action} className="comment-form">
      <input type="hidden" name="item" value={item} />
      {parent && <input type="hidden" name="parent" value={parent} />}
      <textarea name="body" rows={parent ? 2 : 3} required maxLength={10000} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} />
      {state && !state.ok && <p className="form-msg err">{state.message}</p>}
      <div className="comment-form-actions">
        {onDone && <button type="button" className="btn" onClick={onDone}>{t('Cancel')}</button>}
        <Submit label={parent ? t('Reply') : t('Comment')} />
      </div>
    </form>
  );
}

function Comment({ node, item, signedIn, depth }: { node: CommentNode; item: string; signedIn: boolean; depth: number }) {
  const t = useT();
  const locale = useLocale();
  const [replying, setReplying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="comment" id={`c-${node.id}`}>
      <div className="comment-side">
        <UserAvatar name={node.author?.username || '?'} src={node.author?.avatarUrl} size={28} />
        {node.replies.length > 0 && <button type="button" className="comment-line" aria-label={collapsed ? t('Expand replies') : t('Collapse replies')} onClick={() => setCollapsed(!collapsed)} />}
      </div>
      <div className="comment-main">
        <div className="comment-meta">
          {node.author ? <Link href={`/u/${node.author.username}`}>u/{node.author.username}</Link> : <span>{t('deleted user')}</span>}
          <span>· {ago(node.createdAt, t, locale)}</span>
        </div>
        <p className="comment-body">{node.body}</p>
        <div className="comment-actions">
          <HeartButton type="comment" id={node.id} liked={node.liked} signedIn={signedIn} count={node.likes} className="ca-btn ca-heart small" />
          {signedIn
            ? <button type="button" className="ca-btn" onClick={() => setReplying(!replying)}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5h13v8.6h-7.2L5.6 16v-2.9H3.5z" /></svg>{t('Reply')}
              </button>
            : <Link href="/login" className="ca-btn">{t('Reply')}</Link>}
          <CardMenu type="comment" id={node.id} signedIn={signedIn} />
          {collapsed && node.replies.length > 0 && <button type="button" className="ca-btn" onClick={() => setCollapsed(false)}>{node.replies.length === 1 ? t('+{n} reply', { n: node.replies.length }) : t('+{n} replies', { n: node.replies.length })}</button>}
        </div>
        {replying && <CommentForm item={item} parent={node.id} autoFocus placeholder={node.author ? t('Reply to u/{username}', { username: node.author.username }) : t('Reply to comment')} onDone={() => setReplying(false)} />}
        {!collapsed && node.replies.length > 0 && (
          <div className="comment-replies">
            {node.replies.map((r) => <Comment key={r.id} node={r} item={item} signedIn={signedIn} depth={depth + 1} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/** The thread under a post or a news story: replies nest, each with a heart. */
export default function CommentThread({ nodes, item, signedIn }: { nodes: CommentNode[]; item: string; signedIn: boolean }) {
  return <div className="comments">{nodes.map((n) => <Comment key={n.id} node={n} item={item} signedIn={signedIn} depth={0} />)}</div>;
}
