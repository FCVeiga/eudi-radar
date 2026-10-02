'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import HeartButton from '@/components/HeartButton';
import { toggleRepost } from '@/app/social/actions';

/** Reddit-style action bar under a card: heart, comments, repost, share. */
export default function CardActions({ type, id, href, title, likes, liked, comments, reposts, reposted, signedIn }: {
  type: 'post' | 'news' | 'tender'; id: string; href: string; title: string;
  likes: number; liked: boolean; comments: number; reposts: number; reposted: boolean; signedIn: boolean;
}) {
  const [isReposted, setReposted] = useState(reposted);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const repostCount = reposts + (isReposted ? 1 : 0) - (reposted ? 1 : 0);

  useEffect(() => {
    if (!shareOpen) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setShareOpen(false); };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [shareOpen]);

  const url = () => `${window.location.origin}${href}`;
  const open = (u: string) => { window.open(u, '_blank', 'noopener,noreferrer'); setShareOpen(false); };

  return (
    <div className="card-actions">
      <HeartButton type={type} id={id} liked={liked} signedIn={signedIn} count={likes} className="ca-btn ca-heart" />
      <Link href={`${href}#comments`} className="ca-btn" aria-label={`${comments} comments`}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5h13v8.6h-7.2L5.6 16v-2.9H3.5z" /></svg>{comments}
      </Link>
      <button type="button" className={`ca-btn ${isReposted ? 'on' : ''}`} aria-pressed={isReposted} aria-label={isReposted ? 'Undo repost' : 'Repost'}
        onClick={() => {
          if (!signedIn) { router.push(`/login?next=${encodeURIComponent(path || '/')}`); return; }
          setReposted(!isReposted);
          start(async () => { const r = await toggleRepost(type, id); if ('error' in r) setReposted(isReposted); else setReposted(r.reposted); });
        }}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8V6.5A1.5 1.5 0 0 1 6.5 5H15l-2-2M15 12v1.5a1.5 1.5 0 0 1-1.5 1.5H5l2 2" /></svg>{repostCount}
      </button>
      <div className="ca-share" ref={box}>
        <button type="button" className="ca-btn" aria-haspopup="menu" aria-expanded={shareOpen} onClick={() => setShareOpen(!shareOpen)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 4.5 16 9l-5 4.5V11c-4 0-6.5 1.2-8 4 .5-4.3 3-7 8-7.5z" /></svg>Share
        </button>
        {shareOpen && (
          <div className="card-menu-list ca-share-list" role="menu">
            <button type="button" role="menuitem" onClick={async () => { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => { setCopied(false); setShareOpen(false); }, 1200); }}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.4 6.6a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" /></svg>{copied ? 'Link copied' : 'Copy link'}
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button type="button" role="menuitem" onClick={() => { navigator.share({ title, url: url() }).catch(() => {}); setShareOpen(false); }}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M5 5l3-3 3 3M3.5 8v5.5h9V8" /></svg>Share via…
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url())}`)}>
              <span className="ca-brand">in</span>LinkedIn
            </button>
            <button type="button" role="menuitem" onClick={() => open(`https://x.com/intent/post?url=${encodeURIComponent(url())}&text=${encodeURIComponent(title)}`)}>
              <span className="ca-brand">X</span>X
            </button>
            <button type="button" role="menuitem" onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url())}`; setShareOpen(false); }}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="m2.5 4.5 5.5 4 5.5-4" /></svg>Email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
