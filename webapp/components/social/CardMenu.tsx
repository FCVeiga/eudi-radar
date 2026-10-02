'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hideItem, reportItem } from '@/app/social/actions';

const REASONS: [string, string][] = [
  ['spam', 'Spam'], ['misleading', 'Misleading or false'], ['harassment', 'Harassment or abuse'],
  ['off-topic', 'Off-topic'], ['copyright', 'Copyright'], ['other', 'Something else'],
];

/** "…" on a card: Hide (gone from your feeds) and Report. */
export default function CardMenu({ type, id, signedIn, onHidden }: { type: 'post' | 'news' | 'tender' | 'comment'; id: string; signedIn: boolean; onHidden?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const path = usePathname();
  const login = () => router.push(`/login?next=${encodeURIComponent(path || '/')}`);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div className="card-menu" ref={box}>
      <button type="button" className="card-menu-btn" aria-label="More options" aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.5" cy="8" r="1.3" /></svg>
      </button>
      {open && (
        <div className="card-menu-list" role="menu">
          {type !== 'comment' && (
            <button type="button" role="menuitem" onClick={async () => {
              setOpen(false);
              if (!signedIn) return login();
              if (onHidden) onHidden();
              else (box.current?.closest('[data-card]') as HTMLElement | null)?.setAttribute('hidden', '');
              await hideItem(type, id);
            }}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z" /><path d="M3 13 13 3" /></svg>Hide
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); if (!signedIn) return login(); setSent(false); dialog.current?.showModal(); }}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14V2.5M3.5 3h8l-1.5 3 1.5 3h-8" /></svg>Report
          </button>
        </div>
      )}
      <dialog ref={dialog} className="modal" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <form className="modal-body" onSubmit={async (e) => {
          e.preventDefault();
          await reportItem(type, id, reason, details);
          setSent(true);
        }}>
          <div className="modal-head"><h2>Report</h2><button type="button" className="modal-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button></div>
          {sent ? (
            <>
              <p className="form-msg ok">Thanks — we’ll review it.</p>
              <div className="modal-actions"><button type="button" className="btn primary" onClick={() => dialog.current?.close()}>Done</button></div>
            </>
          ) : (
            <>
              <fieldset className="report-reasons">
                <legend className="field-hint">What’s wrong with it?</legend>
                {REASONS.map(([value, label]) => (
                  <label key={value} className={`report-reason ${reason === value ? 'on' : ''}`}>
                    <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />{label}
                  </label>
                ))}
              </fieldset>
              <label className="field"><span>Details <em>— optional</em></span><textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
              <div className="modal-actions"><button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button><button type="submit" className="btn primary">Report</button></div>
            </>
          )}
        </form>
      </dialog>
    </div>
  );
}
