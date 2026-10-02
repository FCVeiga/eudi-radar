import './globals.css';
import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Inter, JetBrains_Mono } from 'next/font/google';
import SearchBox from '@/components/SearchBox';
import SideNav from '@/components/SideNav';
import AccountsSidebar from '@/components/AccountsSidebar';

// Every page reads live from Supabase. Without this, Next prerenders pages
// with no searchParams at build time and serves that frozen snapshot forever.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const sans = Inter({ subsets: ['latin', 'latin-ext', 'greek'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'EUDI Radar — WalliD',
  description: 'Digital identity & wallet opportunity intelligence',
};

// Reddit-style shell: fixed navbar, fixed left sidebar (sections + followed
// accounts); pages render in the remaining area.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand" aria-label="EUDI Radar home">
            <Image src="/wallid-logo-mark.png" alt="WalliD" width={98} height={26} priority />
            <span className="brand-divider" />
            <span className="brand-product">EUDI Radar</span>
          </Link>
          <Suspense fallback={<div className="search-box" />}><SearchBox /></Suspense>
          <div className="auth-buttons">
            <button type="button" className="btn" title="Coming soon">Log in</button>
            <button type="button" className="btn primary" title="Coming soon">Sign up</button>
          </div>
        </header>
        <div className="shell">
          <aside className="sidebar">
            <SideNav />
            <div className="sidebar-rule" />
            <AccountsSidebar />
            <div className="sidebar-foot">WalliD · EUDI Radar<br /><span className="mono">TED · Tavily · official portals</span></div>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
