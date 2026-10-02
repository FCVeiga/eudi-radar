'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FormState, addComment, createPost } from '@/app/social/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
}

export function NewPostForm({ items, preset }: { items: { value: string; label: string }[]; preset?: string }) {
  const [state, action] = useFormState<FormState, FormData>(createPost, null);
  return (
    <form action={action} className="settings-form">
      <label className="field"><span>Title</span><input name="title" required minLength={3} maxLength={300} placeholder="What do you want to share?" /></label>
      <label className="field"><span>Text <em>— optional</em></span><textarea name="body" rows={8} maxLength={20000} placeholder="Your take, a question for the community, lessons from a bid…" /></label>
      <label className="field"><span>About a tender or story <em>— optional, from what you follow</em></span>
        <select name="item" defaultValue={preset ?? ''}>
          <option value="">Nothing in particular</option>
          {items.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
      </label>
      {state && <p className={`form-msg ${state.ok ? 'ok' : 'err'}`} role="status">{state.message}</p>}
      <div className="settings-actions"><Submit label="Post" busy="Posting…" /></div>
    </form>
  );
}

export function CommentForm({ postId }: { postId: string }) {
  const [state, action] = useFormState<FormState, FormData>(addComment, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="settings-form comment-form">
      <input type="hidden" name="post" value={postId} />
      <label className="field"><span className="sr-only">Comment</span><textarea name="body" rows={3} required maxLength={10000} placeholder="Add a comment" /></label>
      {state && !state.ok && <p className="form-msg err">{state.message}</p>}
      <div className="settings-actions"><Submit label="Comment" busy="Posting…" /></div>
    </form>
  );
}
