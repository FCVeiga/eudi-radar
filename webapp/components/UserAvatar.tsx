/** A user's picture, or their initial on a gradient picked from their username. */
const GRADIENTS = [['#00CCFF', '#00FFCC'], ['#A5B4FC', '#4F46E5'], ['#FF5FA2', '#B5367F'], ['#FDE047', '#F59E0B'],
  ['#5EEAD4', '#0D9488'], ['#C084FC', '#7C3AED'], ['#FFB547', '#FF7A59'], ['#94A3B8', '#475569']];

export default function UserAvatar({ name, src, size = 32, className = '' }: { name: string; src?: string | null; size?: number; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`user-avatar ${className}`} src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  const [a, b] = GRADIENTS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % GRADIENTS.length];
  return (
    <span className={`user-avatar initials ${className}`} aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {(name[0] || '?').toUpperCase()}
    </span>
  );
}
