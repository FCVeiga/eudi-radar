'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startEvaluationReport } from '@/app/actions';

const POLL_MS = 5000;
const GIVE_UP_MS = 4 * 60_000;

/**
 * The Evaluation Report Agent's button. Starts the agent (or, if someone
 * already did, waits for it) and refreshes the page when the report is in.
 */
export default function EvaluationRunner({ opportunityId, evaluatedAt, running, ready, lastError }: {
  opportunityId: string; evaluatedAt: string | null; running: boolean; ready: boolean; lastError: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'working' | 'error'>(running ? 'working' : 'idle');
  const [message, setMessage] = useState<string | null>(lastError);
  const poll = useRef<ReturnType<typeof setInterval>>();
  const firstSeen = useRef(evaluatedAt);

  // A new report arrived (this run or someone else's): stop waiting.
  useEffect(() => {
    if (evaluatedAt !== firstSeen.current) { clearInterval(poll.current); setState('idle'); setMessage(null); firstSeen.current = evaluatedAt; }
  }, [evaluatedAt]);
  useEffect(() => () => clearInterval(poll.current), []);

  function waitForReport() {
    const since = Date.now();
    poll.current = setInterval(() => {
      if (Date.now() - since > GIVE_UP_MS) { clearInterval(poll.current); setState('error'); setMessage('the run is taking too long'); return; }
      router.refresh();
    }, POLL_MS);
  }
  useEffect(() => { if (running) waitForReport(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setState('working'); setMessage(null);
    try {
      const r = await startEvaluationReport(opportunityId);
      if (r.status === 'done') { setState('idle'); router.refresh(); }
      else if (r.status === 'running') waitForReport();
      else { setState('error'); setMessage(r.message ?? 'unknown error'); }
    } catch { setState('error'); setMessage('the request failed'); }
  }

  if (state === 'working') {
    return (
      <p className="report-progress">
        <span className="dots" /> The Evaluation Report Agent is checking every requirement against WalliD&apos;s profile — about a minute.
      </p>
    );
  }
  return (
    <div className="eval-run">
      <button className="btn-agent" onClick={run} disabled={!ready}>
        {evaluatedAt ? 'Re-run evaluation' : 'Run Evaluation Report Agent'}
      </button>
      {!ready && <span className="eval-note">Waits for the Tender Analysis agent to read this tender.</span>}
      {message && <span className="form-msg err">Couldn&apos;t run: {message}.</span>}
    </div>
  );
}
