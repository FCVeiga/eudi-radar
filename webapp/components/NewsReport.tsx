'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startNewsReport } from '@/app/actions';

/** The agent's face: a friendly robot on the brand gradient. */
export function AgentFace({ size = 44, working = false }: { size?: number; working?: boolean }) {
  return (
    <svg className={`agent-face ${working ? 'working' : ''}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="agent-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00CCFF" /><stop offset="1" stopColor="#00FFCC" /></linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#agent-bg)" />
      <line x1="24" y1="8" x2="24" y2="13" stroke="#1A233B" strokeWidth="2" strokeLinecap="round" />
      <circle className="agent-antenna" cx="24" cy="7" r="2.2" fill="#1A233B" />
      <rect x="11" y="13" width="26" height="21" rx="7" fill="#fff" stroke="#1A233B" strokeWidth="2" />
      <rect x="15" y="19" width="18" height="8" rx="4" fill="#1A233B" />
      <circle className="agent-eye" cx="20" cy="23" r="2" fill="#00FFCC" />
      <circle className="agent-eye" cx="28" cy="23" r="2" fill="#00FFCC" />
      <path d="M20 30.5c2.4 1.4 5.6 1.4 8 0" stroke="#1A233B" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <rect x="8" y="20" width="3" height="7" rx="1.5" fill="#1A233B" />
      <rect x="37" y="20" width="3" height="7" rx="1.5" fill="#1A233B" />
    </svg>
  );
}

const POLL_MS = 5000;
const GIVE_UP_MS = 4 * 60_000;

/**
 * Mounted on a news page that has no report yet: starts the News Report Agent
 * (or, if another visitor already did, waits for it) and refreshes the page
 * when the summary and report are ready.
 */
export default function NewsReportRunner({ newsId, lastError }: { newsId: string; lastError: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;  // once per page view (React strict mode mounts twice in dev)
    started.current = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    startNewsReport(newsId).then((r) => {
      if (r.status === 'done') router.refresh();
      else if (r.status === 'running') {
        const since = Date.now();
        poll = setInterval(() => {
          if (Date.now() - since > GIVE_UP_MS) { clearInterval(poll); setState('error'); setMessage('the run is taking too long'); return; }
          router.refresh();  // the page stops rendering this component once the report exists
        }, POLL_MS);
      } else { setState('error'); setMessage(r.message ?? 'unknown error'); }
    }).catch(() => { setState('error'); setMessage('the request failed'); });
    return () => { if (poll) clearInterval(poll); };
  }, [newsId, router]);

  if (state === 'error') {
    return (
      <p className="form-msg err">
        The News Report Agent couldn&apos;t run: {message ?? lastError}. It will try again the next time this page is opened.
      </p>
    );
  }
  return (
    <p className="report-progress">
      <span className="dots" /> The News Report Agent is reading the full article and writing the summary and its report — about a minute.
    </p>
  );
}
