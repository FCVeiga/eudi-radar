import './globals.css';
import Image from 'next/image';
import Link from 'next/link';
import { Inter, JetBrains_Mono } from 'next/font/google';
import TopNav from '@/components/TopNav';

// Every page reads live from Supabase. Without this, Next prerenders pages
// with no searchParams at build time and serves that frozen snapshot forever.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const sans = Inter({ subsets: ['latin', 'latin-ext', 'greek'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'Opportunity Radar — WalliD',
  description: 'Digital identity & wallet opportunity intelligence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand" aria-label="Opportunity Radar home">
              <Image src="/wallid-logo-mark.png" alt="WalliD" width={98} height={26} priority />
              <span className="brand-divider" />
              <span className="brand-product">Opportunity Radar</span>
            </Link>
            <TopNav />
            <span className="live-pill" title="Pages read live from the database">
              <span className="live-dot" />Live
            </span>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <span>WalliD Opportunity Radar</span>
            <span className="mono">Sources: TED · Tavily · official portals</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
