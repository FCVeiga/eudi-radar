import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPlatformLanguage } from '@/lib/language';
import { ACHIEVEMENTS, getComments, getFollowing, getPosts, getProfile, getProfileStats } from '@/lib/profile';
import { getFeedLikes, likeTarget } from '@/lib/likes';
import FeedCard from '@/components/FeedCard';
import UserAvatar from '@/components/UserAvatar';
import { CRED } from '@/lib/terms';
import StartChatButton from '@/components/social/StartChatButton';
import ImageEditButton from '@/components/auth/ImageEditButton';
import FollowButton from '@/components/social/FollowButton';
import CommunityCard from '@/components/social/CommunityCard';
import { getLikedPosts } from '@/lib/community';
import { getSupabaseServerClient } from '@/lib/supabase';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'comments', label: 'Comments' },
  { key: 'following', label: 'Following' },
  { key: 'about', label: 'About' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export async function generateMetadata({ params }: { params: { username: string } }) {
  return { title: `u/${params.username} — EUDI Radar` };
}

/** A user's profile, laid out like Reddit's: header, tabs, and a sidebar card. */
export default async function ProfilePage({ params, searchParams }: { params: { username: string }; searchParams: { tab?: string } }) {
  await getPlatformLanguage();
  const [profile, me] = await Promise.all([getProfile(params.username), getCurrentUser()]);
  if (!profile) notFound();
  const own = me?.id === profile.id;
  const tab: Tab = (TABS.find((t) => t.key === searchParams.tab)?.key ?? 'posts');
  const stats = await getProfileStats(profile.id);
  const iFollow = !own && me ? !!(await getSupabaseServerClient().from('user_follows').select('followee_id')
    .eq('follower_id', me.id).eq('followee_id', profile.id).maybeSingle()).data : false;
  const now = new Date();

  let body: React.ReactNode;
  if (tab === 'posts') {
    const posts = await getPosts(profile.id);
    body = posts.length ? posts.map((p: any) => (
      <Link key={p.id} href={`/posts/${p.id}`} className="profile-post"><h3>{p.title}</h3>{p.body && <p className="profile-post-body">{p.body}</p>}<span className="profile-meta">{p.score} {CRED} · {fmt(p.created_at)}</span></Link>
    )) : <Empty own={own} who={profile.username} what="posts" hint={own ? 'Share a take on a tender, a question for the market, or lessons from a bid.' : 'Their posts will show here.'} cta={own ? { href: '/posts/new', label: 'Create a post' } : undefined} />;
  } else if (tab === 'comments') {
    const comments = await getComments(profile.id);
    body = comments.length ? comments.map((c: any) => (
      <Link key={c.id} href={`/posts/${c.post_id}`} className="profile-post"><span className="profile-meta">on “{c.posts?.title}” · {fmt(c.created_at)}</span><p className="profile-post-body">{c.body}</p></Link>
    )) : <Empty own={own} who={profile.username} what="comments" hint="Comments on other people’s posts will show here." />;
  } else if (tab === 'following') {
    if (!own) {
      body = <div className="profile-empty"><p className="profile-empty-title">Only u/{profile.username} can see what they follow.</p></div>;
    } else {
      const [items, likedPosts] = await Promise.all([getFollowing(profile.id), getLikedPosts(profile.id, now)]);
      const likes = await getFeedLikes(items.map((i) => i.href));
      // Tenders, news and posts together, most recently liked first.
      const all = [
        ...items.map((i) => ({ at: i.at.getTime(), node: (() => { const t = likeTarget(i.href); return <FeedCard key={i.key} item={i} now={now} like={{ liked: !!t && likes.liked.has(`${t[0]}:${t[1]}`), signedIn: true }} />; })() })),
        ...likedPosts.map(({ post, likedAt }) => ({ at: new Date(likedAt).getTime(), node: <CommunityCard key={`post:${post.id}`} post={post} now={now} liked signedIn /> })),
      ].sort((a, b) => b.at - a.at);
      body = all.length
        ? <div className="feed">{all.map((x) => x.node)}</div>
        : <Empty own hint="Tap the heart on any tender, news story or post to follow it — it lands here." who={profile.username} what="follows" />;
    }
  } else {
    body = (
      <div className="profile-about">
        <section className="detail-block">
          <h2>About</h2>
          {profile.bio ? <p className="profile-bio">{profile.bio}</p>
            : <p className="muted">{own ? 'Tell people who you are and what you bid on.' : `u/${profile.username} hasn’t written anything yet.`}</p>}
          {own && <Link href="/profile/edit" className="btn">{profile.bio ? 'Edit description' : 'Add a description'}</Link>}
        </section>
        <section className="detail-block">
          <h2>Achievements <span className="uc-count">0/{ACHIEVEMENTS.length}</span></h2>
          <div className="trophies">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.key} className="trophy locked" title={a.how}>
                <span className="trophy-icon" aria-hidden="true">{a.icon}</span>
                <span><strong>{a.name}</strong><em>{a.how}</em></span>
              </div>
            ))}
          </div>
          <p className="field-hint">Achievements unlock as you post, comment and follow — coming with the community features.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="profile">
      <div className="profile-main">
        <header className="profile-head">
          <UserAvatar name={profile.username} src={profile.avatarUrl} size={72} className="profile-avatar" />
          <div className="profile-names">
            <h1>{profile.displayName}</h1>
            <span className="profile-handle">u/{profile.username}</span>
          </div>
          {own && <Link href="/profile/edit" className="btn profile-edit-top">Edit profile</Link>}
          {!own && me && <span className="profile-chat-top"><FollowButton username={profile.username} following={iFollow} /><StartChatButton username={profile.username} /></span>}
          {!own && !me && <Link href={`/login?next=/u/${profile.username}`} className="btn profile-chat-top">Log in to chat</Link>}
        </header>

        <nav className="feed-sort section-tabs profile-tabs" aria-label="Profile sections">
          {TABS.map((t) => (
            <Link key={t.key} href={t.key === 'posts' ? `/u/${profile.username}` : `/u/${profile.username}?tab=${t.key}`}
              className={`feed-sort-link ${tab === t.key ? 'active' : ''}`} aria-current={tab === t.key ? 'page' : undefined}>
              {t.label}
              {t.key === 'posts' && <span className="pill-count">{stats.posts}</span>}
              {t.key === 'comments' && <span className="pill-count">{stats.comments}</span>}
              {t.key === 'following' && own && <span className="pill-count">{stats.following}</span>}
            </Link>
          ))}
        </nav>

        <div className="profile-body">{body}</div>
      </div>

      <aside className="profile-side">
        <div className="profile-card">
          <div className="profile-banner" style={profile.bannerUrl ? { backgroundImage: `url(${JSON.stringify(profile.bannerUrl)})` } : undefined}>
            {own && <ImageEditButton kind="banner" className="banner-edit" />}
          </div>
          <div className="profile-card-body">
            <div className="profile-card-avatar-wrap">
              <UserAvatar name={profile.username} src={profile.avatarUrl} size={56} className="profile-card-avatar" />
              {own && <ImageEditButton kind="avatar" className="avatar-edit" />}
            </div>
            <h2>{profile.displayName}</h2>
            <span className="profile-handle">u/{profile.username}</span>
            {profile.bio && <p className="profile-card-bio">{profile.bio}</p>}
            {own && <Link href="/profile/edit" className="btn primary profile-card-edit">Edit profile</Link>}
            {!own && me && <div className="profile-card-edit profile-card-actions"><FollowButton username={profile.username} following={iFollow} /><StartChatButton username={profile.username} /></div>}
            <dl className="profile-stats">
              <div><dt>{stats.postCred}</dt><dd>Post {CRED}</dd></div>
              <div><dt>{stats.commentCred}</dt><dd>Comment {CRED}</dd></div>
              <div><dt>{stats.followers}</dt><dd>Followers</dd></div>
              <div><dt>{stats.followingPeople}</dt><dd>Following</dd></div>
              <div><dt>{fmt(profile.createdAt)}</dt><dd>Membership day</dd></div>
              <div><dt>{own ? stats.following : '—'}</dt><dd>Liked items</dd></div>
            </dl>
            <div className="profile-card-section">
              <h3>Trophy case</h3>
              <div className="trophy-row">
                {ACHIEVEMENTS.map((a) => <span key={a.key} className="trophy-mini locked" title={`${a.name} — ${a.how} (locked)`} aria-label={`${a.name}, locked`}>{a.icon}</span>)}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Empty({ own, who, what, hint, cta }: { own: boolean; who: string; what: string; hint: string; cta?: { href: string; label: string } }) {
  return (
    <div className="profile-empty">
      <p className="profile-empty-title">{own ? `You don’t have any ${what} yet` : `u/${who} hasn’t got any ${what} yet`}</p>
      <p className="muted">{hint}</p>
      {cta && <Link href={cta.href} className="btn primary profile-empty-cta">{cta.label}</Link>}
    </div>
  );
}
