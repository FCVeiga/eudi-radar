/** A tender update shown like a Reddit comment: who posted it, when, and what changed. */

export type UpdateEvent = {
  id: number;
  opportunity_id: string;
  event_type: string | null;
  description: string | null;
  detected_at: string | null;
  notice_url: string | null;
  note_source: string | null;
  note: string | null;
};

function ago(iso: string | null) {
  if (!iso) return '';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days < 1) return 'today';
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const LABELS: Record<string, string> = {
  deadline: 'Deadline change', status: 'Status change', notice_update: 'Tender update',
};

export default function UpdateComment({ e, compact = false }: { e: UpdateEvent; compact?: boolean }) {
  const fromTed = !!e.notice_url?.includes('ted.europa.eu');
  // English note when the agent has written one; otherwise the detected change
  // plus what the notice itself says (possibly in its own language).
  const original = !e.note && e.note_source ? e.note_source.replace(/^Reason:\s*/, '') : null;
  return (
    <div className={`update-comment ${compact ? 'compact' : ''}`}>
      <span className="uc-avatar" aria-hidden="true">
        <svg viewBox="0 0 20 20"><rect x="4" y="6" width="12" height="9" rx="3" /><path d="M10 3.5V6M7.5 10h.01M12.5 10h.01M8 12.6c1.2.7 2.8.7 4 0" /></svg>
      </span>
      <div className="uc-body">
        <div className="uc-meta">
          <strong>{fromTed ? 'TED monitor' : 'Radar agent'}</strong>
          <span className="uc-kind">{LABELS[e.event_type ?? ''] ?? 'Update'}</span>
          <span className="uc-time">· {ago(e.detected_at)}</span>
        </div>
        <p className="uc-text">
          {e.note || e.description?.replace(/\s*\(TED [\d-]+\)$/, '')}
          {original && <span className="uc-original" title={e.note_source ?? ''}> “{original}”</span>}
        </p>
      </div>
    </div>
  );
}
