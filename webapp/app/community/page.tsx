import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getPlatformLanguage } from '@/lib/language';
import { COMMUNITY_VIEWS, CommunityView, getCommunityFeed } from '@/lib/community';
import { getLikes } from '@/lib/likes';
import CommunityCard from '@/components/social/CommunityCard';

export const metadata = { title: 'Community — EUDI Radar' };
const PAGE = 25;

const ICONS: Record<CommunityView, JSX.Element> = {
  best: <path d="M8 2.5c.3 2 2.6 2.9 2.6 5.6A2.6 2.6 0 0 1 8 10.7a2.6 2.6 0 0 1-2.6-2.6c0-1.1.5-1.8 1-2.4-.1 1 .5 1.7 1.1 1.7C7.5 5.5 7.2 4 8 2.5zM4 10.5a4 4 0 0 0 8 0" />,
  new: <><circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2.2 1.6" /></>,
  top: <path d="M3 12.5 7 8.5l2.2 2.2L13 6.5M10 6.5h3v3" />,
};

/** Community Feed: members' posts, ranked for you (see lib/community.ts). */
export default async function CommunityPage({ searchParams }: { searchParams: { view?: string; n?: string } }) {
  await getPlatformLanguage();
  const now = new Date();
  const view = (COMMUNITY_VIEWS.find((v) => v.slug === searchParams.view)?.slug ?? 'best') as CommunityView;
  const user = await getCurrentUser();
  const posts = await getCommunityFeed(view, user?.id ?? null, now);
  const shown = Math.max(PAGE, Number(searchParams.n) || PAGE);
  const likes = await getLikes('post', posts.slice(0, shown).map((p) => p.id));
  const href = (v: CommunityView, n?: number) => {
    const p = new URLSearchParams();
    if (v !== 'best') p.set('view', v);
    if (n) p.set('n', String(n));
    return `/community${p.toString() ? `?${p}` : ''}`;
  };

  return (
    <div className="community">
      <div className="community-head">
        <h1 className="opps-h1">Community</h1>
        {user ? <Link href="/posts/new" className="btn primary">Create a post</Link> : <Link href="/login?next=/posts/new" className="btn">Log in to post</Link>}
      </div>
      <nav className="feed-sort" aria-label="Sort posts">
        {COMMUNITY_VIEWS.map((v) => (
          <Link key={v.slug} href={href(v.slug)} className={`feed-sort-link ${view === v.slug ? 'active' : ''}`} aria-current={view === v.slug ? 'page' : undefined}>
            <svg className="feed-sort-icon" viewBox="0 0 16 16" aria-hidden="true">{ICONS[v.slug]}</svg>{v.label}
          </Link>
        ))}
      </nav>

      {posts.length === 0 ? (
        <div className="profile-empty">
          <p className="profile-empty-title">No posts yet — start the conversation</p>
          <p className="muted">Share a take on a tender, ask the market a question, or post lessons from a bid.</p>
          <Link href={user ? '/posts/new' : '/login?next=/posts/new'} className="btn primary profile-empty-cta">Create the first post</Link>
        </div>
      ) : (
        <div className="feed">
          {posts.slice(0, shown).map((p) => <CommunityCard key={p.id} post={p} now={now} liked={likes.liked.has(p.id)} signedIn={likes.signedIn} />)}
        </div>
      )}
      {posts.length > shown && <Link href={href(view, shown + PAGE)} scroll={false} className="feed-more">Show more <span className="mono">({posts.length - shown} left)</span></Link>}
      <p className="field-hint community-note">
        {view === 'best' ? 'Best ranks posts by how well their tags match your interests and the radar’s search scope, whether you follow the author, how many likes they have, and how recent they are.'
          : view === 'new' ? 'Newest posts first.' : 'Most liked posts first.'}
      </p>
    </div>
  );
}
