import './globals.css';
import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Inter, JetBrains_Mono } from 'next/font/google';
import SearchBox from '@/components/SearchBox';
import SideNav from '@/components/SideNav';
import SourcesSidebar from '@/components/SourcesSidebar';
import WorkingAgents from '@/components/WorkingAgents';
import { getPlatformLanguage } from '@/lib/language';
import { BottomNav, MenuBackdrop, MenuButton } from '@/components/MobileNav';

// Every page reads live from Supabase. Without this, Next prerenders pages
// with no searchParams at build time and serves that frozen snapshot forever.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const sans = Inter({ subsets: ['latin', 'latin-ext', 'greek'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

// viewport-fit=cover: the layout pads itself for the notch and home indicator.
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };

export const metadata = {
  title: 'EUDI Radar — WalliD',
  description: 'Digital identity & wallet opportunity intelligence',
};

// Reddit-style shell: fixed navbar, fixed left sidebar (sections + followed
// accounts); pages render in the remaining area.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = await getPlatformLanguage();
  return (
    <html lang={language.code} className={`${sans.variable} ${mono.variable}`}>
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
          <MenuButton />
        </header>
        <div className="shell">
          <MenuBackdrop />
          <aside className="sidebar" aria-label="Sources and agents">
            <SideNav />
            <div className="sidebar-rule" />
            <SourcesSidebar />
            <div className="sidebar-rule" />
            <WorkingAgents />
            <div className="sidebar-auth">
              <button type="button" className="btn" title="Coming soon">Log in</button>
              <button type="button" className="btn primary" title="Coming soon">Sign up</button>
            </div>
            <div className="sidebar-foot">WalliD · EUDI Radar<br /><span className="mono">TED · Tavily · official portals</span></div>
          </aside>
          <main className="content">{children}</main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
