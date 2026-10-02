import { getAccounts } from '@/lib/accounts';
import { PLATFORMS } from '@/lib/platforms';
import PlatformIcon from './PlatformIcon';
import AddAccount from './AddAccount';

function accountHref(platform: string, handle: string) {
  if (platform === 'twitter') return `https://x.com/${handle.replace(/^@/, '')}`;
  if (platform === 'reddit') return `https://www.reddit.com/${handle.replace(/^u\//, 'user/')}`;
  return handle;
}

export default async function AccountsSidebar() {
  const accounts = await getAccounts();
  return (
    <div className="side-panel">
      <div className="side-head">
        <h3>Following</h3>
        <span className="side-count">{accounts.length}</span>
      </div>
      {accounts.length === 0 && <p className="side-empty">Not following anyone yet.</p>}
      <ul className="account-list">
        {accounts.map((a) => {
          const connectable = PLATFORMS[a.platform]?.connectable && a.feed_url;
          const state = !connectable ? 'off' : a.last_error ? 'err' : 'ok';
          const note = !connectable ? 'Not connected — needs API access'
            : a.last_error ? `Last fetch failed: ${a.last_error}` : 'Connected';
          return (
            <li key={a.id}>
              <a href={accountHref(a.platform, a.handle_or_url)} target="_blank" rel="noopener noreferrer"
                 className={`account ${state}`} title={`${PLATFORMS[a.platform]?.label ?? a.platform} · ${note}`}>
                <PlatformIcon platform={a.platform} size={24} />
                <span className="account-name">{a.display_name}</span>
                <span className={`account-state ${state}`} aria-label={note} />
              </a>
            </li>
          );
        })}
      </ul>
      <AddAccount />
    </div>
  );
}
