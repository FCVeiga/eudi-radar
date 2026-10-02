import Image from 'next/image';

/** Centered card for the log-in / sign-up pages. */
export default function AuthCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Image src="/wallid-logo-mark.png" alt="WalliD" width={98} height={26} className="auth-logo" />
        <h1>{title}</h1>
        {sub && <p className="auth-sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
