'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startNewsReport } from '@/app/actions';

const POLL_MS = 5000;
const GIVE_UP_MS = 4 * 60_000;

/**
 * Mounted on a news page that has no report yet: starts the News Report Agent
 * (or, if another visitor already did, waits for it) and refreshes the page
 * when the summary and report are ready.
 */
export default function NewsReportRunner({ newsId, scopeId, lastError }: { newsId: string; scopeId: string; lastError: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;  // once per page view (React strict mode mounts twice in dev)
    started.current = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    startNewsReport(newsId, scopeId).then((r) => {
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
