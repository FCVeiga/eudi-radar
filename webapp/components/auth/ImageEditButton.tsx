'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAvatarUpload, setAvatar } from '@/app/auth/actions';
import { useT } from '@/lib/i18n/client';

/** Pencil on the profile card: replace the banner or the profile picture. */
export default function ImageEditButton({ kind, className = '' }: { kind: 'avatar' | 'banner'; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const label = kind === 'banner' ? t('Change banner image') : t('Change profile picture');

  async function upload(file: File) {
    setError(null);
    const target = await createAvatarUpload(file.name, file.size, kind);
    if ('error' in target) { setError(target.error ?? t('Upload failed')); return; }
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    const res = await fetch(target.url!, { method: 'PUT', body, headers: { 'x-upsert': 'false' } });
    if (!res.ok) { setError(t('Upload failed ({status})', { status: res.status })); return; }
    const done = await setAvatar(target.path!, kind);
    if ('error' in done) setError(done.error ?? t('Could not save'));
    router.refresh();
  }

  return (
    <>
      <button type="button" className={`image-edit ${busy ? 'busy' : ''} ${className}`} aria-label={label} title={error ?? label}
        disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <span className="dots" /> : (
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.7a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5 2.5 13.5l1-3.1z" /><path d="m9.6 3.9 2.5 2.5" /></svg>
        )}
      </button>
      {error && <span className="image-edit-error" role="status">{error}</span>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) start(() => upload(f)); e.target.value = ''; }} />
    </>
  );
}
