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
import { getCurrentUser } from '@/lib/auth';
import UserMenu, { type WorkspaceGroup } from '@/components/auth/UserMenu';
import { getContext, getMyAccounts } from '@/lib/accounts';
import NavActions from '@/components/social/NavActions';
import UserAvatar from '@/components/UserAvatar';
import { logOut } from '@/app/auth/actions';
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
  const [language, user] = await Promise.all([getPlatformLanguage(), getCurrentUser()]);
  const [accounts, ctx] = user ? await Promise.all([getMyAccounts(), getContext()]) : [[], null];
  const groups: WorkspaceGroup[] = accounts.map(({ account: a, workspaces }) => ({
    label: a.kind === 'personal' ? 'Personal' : a.name, plan: a.kind === 'platform' ? 'Platform' : a.plan.name,
    items: workspaces.map((w) => ({ id: w.id, name: w.name })),
  }));
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
          {user && <NavActions />}
          <div className="auth-buttons">
            {user ? <UserMenu user={{ username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl }} groups={groups} currentWorkspace={ctx?.workspace.id ?? null} /> : (
              <>
                <Link href="/login" className="btn">Log in</Link>
                <Link href="/signup" className="btn primary">Sign up</Link>
              </>
            )}
          </div>
          <MenuButton />
        </header>
        <div className="shell">
          <MenuBackdrop />
          <aside className="sidebar" aria-label="Sources and agents">
            {ctx && (
              <Link href="/workspace" className="ws-chip" title="Your current workspace — switch from your account menu">
                <span className="ws-chip-dot" aria-hidden="true" />
                <span><strong>{ctx.workspace.name}</strong><em>{ctx.account.kind === 'personal' ? 'Personal' : ctx.account.name} · {ctx.account.kind === 'platform' ? 'Platform' : ctx.account.plan.name}</em></span>
              </Link>
            )}
            <SideNav />
            <div className="sidebar-rule" />
            <SourcesSidebar />
            <div className="sidebar-rule" />
            <WorkingAgents />
            {user ? (
              <div className="sidebar-user">
                <Link href={`/u/${user.username}`} className="sidebar-user-card">
                  <UserAvatar name={user.username} src={user.avatarUrl} size={40} />
                  <span><strong>{user.displayName}</strong><em>u/{user.username}</em></span>
                </Link>
                <nav className="sidebar-user-links">
                  <Link href="/posts/new">New post</Link><Link href="/notifications">Notifications</Link><Link href="/chat">Chat</Link><Link href="/workspace">Workspace</Link><Link href="/settings">Settings</Link>
                  <Link href="/help">Help</Link><Link href="/terms">Terms &amp; Conditions</Link><Link href="/privacy">Privacy policy</Link>
                </nav>
                <form action={logOut}><button type="submit" className="btn">Log out</button></form>
              </div>
            ) : (
              <div className="sidebar-auth">
                <Link href="/login" className="btn">Log in</Link>
                <Link href="/signup" className="btn primary">Sign up</Link>
              </div>
            )}
            <div className="sidebar-foot">WalliD · EUDI Radar<br /><span className="mono">TED · Tavily · official portals</span></div>
          </aside>
          <main className="content">{children}</main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
