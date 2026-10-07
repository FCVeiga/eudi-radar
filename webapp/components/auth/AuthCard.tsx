import BrandLogo from '@/components/BrandLogo';

/** Centered card for the log-in / sign-up pages. */
export default function AuthCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><BrandLogo size={30} /></div>
        <h1>{title}</h1>
        {sub && <p className="auth-sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
