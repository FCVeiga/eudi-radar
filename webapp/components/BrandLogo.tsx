/** Wordmark for the navbar, or the full mark for places like the sign-in card. Light and dark each have their own asset. */
export default function BrandLogo({ variant = 'wordmark' }: { variant?: 'wordmark' | 'full' }) {
  const light = variant === 'full' ? '/brand/logo.png' : '/brand/wordmark.png';
  const dark = variant === 'full' ? '/brand/logo-white.png' : '/brand/wordmark-white.png';
  return (
    <span className={`brand-logo ${variant}`}>
      <img src={light} alt="Tender Town" className="brand-img light" />
      <img src={dark} alt="Tender Town" className="brand-img dark" />
    </span>
  );
}
