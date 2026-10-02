import UserAvatar from '@/components/UserAvatar';

const BADGE: Record<string, { emoji: string; cls: string }> = {
  like_post: { emoji: '♥', cls: 'like' }, like_comment: { emoji: '♥', cls: 'like' },
  comment: { emoji: '💬', cls: 'comment' }, reply: { emoji: '↩', cls: 'comment' },
  new_tender: { emoji: '📋', cls: 'tender' }, tender_update: { emoji: '📌', cls: 'tender' },
  follow: { emoji: '+', cls: 'social' }, chat_request: { emoji: '💬', cls: 'social' }, chat_accepted: { emoji: '✓', cls: 'social' },
};

/** A notification's picture: the person (with a small type badge), or the type's icon. */
export default function NotificationIcon({ type, actor, size = 36 }: { type: string; actor: { username: string; avatarUrl: string | null } | null; size?: number }) {
  const b = BADGE[type] ?? { emoji: '🔔', cls: 'social' };
  return (
    <span className="ni" style={{ width: size, height: size }}>
      {actor ? <UserAvatar name={actor.username} src={actor.avatarUrl} size={size} /> : <span className={`ni-plain ${b.cls}`} style={{ width: size, height: size }}>{b.emoji}</span>}
      {actor && <span className={`ni-badge ${b.cls}`} aria-hidden="true">{b.emoji}</span>}
    </span>
  );
}
