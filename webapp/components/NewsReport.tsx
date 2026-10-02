'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { triggerNewsReport, NewsReportState } from '@/app/actions';

/** The agent's face: a friendly robot on the brand gradient. */
export function AgentFace({ size = 44 }: { size?: number }) {
  return (
    <svg className="agent-face" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="agent-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00CCFF" /><stop offset="1" stopColor="#00FFCC" /></linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#agent-bg)" />
      <line x1="24" y1="8" x2="24" y2="13" stroke="#1A233B" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="7" r="2.2" fill="#1A233B" />
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

function TriggerButton({ again }: { again: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className={`btn ${again ? '' : 'primary'} trigger`} disabled={pending}>
        {pending ? 'Reading the article…' : again ? 'Run report again' : 'Trigger agent report'}
      </button>
      {pending && <p className="report-progress"><span className="dots" /> The News Report Agent is reading the article and preparing its report — this takes about a minute.</p>}
    </>
  );
}

export default function NewsReportTrigger({ newsId, hasReport }: { newsId: string; hasReport: boolean }) {
  const router = useRouter();
  const [state, action] = useFormState<NewsReportState, FormData>(triggerNewsReport, null);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} className="report-trigger">
      <input type="hidden" name="news_id" value={newsId} />
      <TriggerButton again={hasReport} />
      {state && !state.ok && <p className="form-msg err">{state.message}</p>}
    </form>
  );
}
