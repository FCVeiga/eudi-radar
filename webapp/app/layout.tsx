import './globals.css';
import Link from 'next/link';
import Nav from '@/components/Nav';

// Every page reads live from Supabase. Without this, Next prerenders pages
// with no searchParams at build time and serves that frozen snapshot forever.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export const metadata = {
  title: 'Opportunity Radar — Biometrid',
  description: 'Digital ID / Wallet Intelligence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <div className="rail">
            <Link href="/">
              <div className="brand-mark">Opportunity Radar</div>
              <div className="brand-sub">Digital ID / Wallet Intelligence</div>
            </Link>
            <Nav />
            <div className="rail-footer">
              <div><span className="dot"></span>Live — Supabase</div>
            </div>
          </div>
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
