'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FormState, addComment } from '@/app/social/actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
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
