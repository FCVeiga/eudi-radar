import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPlatformLanguage } from '@/lib/language';
import { ACHIEVEMENTS, getComments, getFollowing, getPosts, getProfile, getProfileStats } from '@/lib/profile';
import { getFeedLikes, likeTarget } from '@/lib/likes';
import FeedCard from '@/components/FeedCard';
import UserAvatar from '@/components/UserAvatar';

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
  const now = new Date();

  let body: React.ReactNode;
  if (tab === 'posts') {
    const posts = await getPosts(profile.id);
    body = posts.length ? posts.map((p: any) => (
      <article key={p.id} className="profile-post"><h3>{p.title}</h3>{p.body && <p>{p.body}</p>}<span className="profile-meta">{p.score} points · {fmt(p.created_at)}</span></article>
    )) : <Empty own={own} who={profile.username} what="posts" hint="Posts arrive with the community feed — tenders, news and discussion from people in the market." />;
  } else if (tab === 'comments') {
    const comments = await getComments(profile.id);
    body = comments.length ? comments.map((c: any) => (
      <article key={c.id} className="profile-post"><span className="profile-meta">on “{c.posts?.title}” · {fmt(c.created_at)}</span><p>{c.body}</p></article>
    )) : <Empty own={own} who={profile.username} what="comments" hint="Comments on other people’s posts will show here." />;
  } else if (tab === 'following') {
    if (!own) {
      body = <div className="profile-empty"><p className="profile-empty-title">Only u/{profile.username} can see what they follow.</p></div>;
    } else {
      const items = await getFollowing(profile.id);
      const likes = await getFeedLikes(items.map((i) => i.href));
      body = items.length
        ? <div className="feed">{items.map((i) => {
            const t = likeTarget(i.href);
            return <FeedCard key={i.key} item={i} now={now} like={{ liked: !!t && likes.liked.has(`${t[0]}:${t[1]}`), signedIn: true }} />;
          })}</div>
        : <Empty own hint="Tap the heart on any tender or news story to follow it — it lands here." who={profile.username} what="follows" />;
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
          <div className="profile-banner" />
          <div className="profile-card-body">
            <UserAvatar name={profile.username} src={profile.avatarUrl} size={56} className="profile-card-avatar" />
            <h2>{profile.displayName}</h2>
            <span className="profile-handle">u/{profile.username}</span>
            {profile.bio && <p className="profile-card-bio">{profile.bio}</p>}
            {own && <Link href="/profile/edit" className="btn primary profile-card-edit">Edit profile</Link>}
            <dl className="profile-stats">
              <div><dt>{stats.postKarma}</dt><dd>Post karma</dd></div>
              <div><dt>{stats.commentKarma}</dt><dd>Comment karma</dd></div>
              <div><dt>{fmt(profile.createdAt)}</dt><dd>Cake day</dd></div>
              <div><dt>{own ? stats.following : '—'}</dt><dd>Following</dd></div>
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

function Empty({ own, who, what, hint }: { own: boolean; who: string; what: string; hint: string }) {
  return (
    <div className="profile-empty">
      <p className="profile-empty-title">{own ? `You don’t have any ${what} yet` : `u/${who} hasn’t got any ${what} yet`}</p>
      <p className="muted">{hint}</p>
    </div>
  );
}
