import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import CardActions from './CardActions';
import CardMenu from './CardMenu';
import { timeAgo } from '@/lib/feed';
import type { PostCard } from '@/lib/community';
import type { Engagement } from '@/lib/engagement';
import { getLocale, getTSync } from '@/lib/i18n/server';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A post in the Community Feed (Reddit-style): score, author · time · tags, …, content, action bar. */
export default function CommunityCard({ post, now, engagement, signedIn }: { post: PostCard; now: Date; engagement: Engagement; signedIn: boolean }) {
  const t = getTSync();
  const why = t('Score {score}: relevance {relevance}, following {following}, likes {likes}, recency {recency}', {
    score: post.score, relevance: pct(post.parts.relevance), following: post.parts.following ? t('yes') : t('no'), likes: post.likes, recency: pct(post.parts.recency),
  });
  const href = `/posts/${post.id}`;
  return (
    <article className="feed-item community-card" data-card>
      <div className="feed-votes cc-score" title={why}>
        <span className="feed-votes-num">{post.score}</span>
        <span className="cc-score-label">{t('score')}</span>
      </div>
      <div className="feed-body">
        <div className="feed-meta cc-meta">
          {post.author && (
            <Link href={`/u/${post.author.username}`} className="cc-author-link">
              <UserAvatar name={post.author.username} src={post.author.avatarUrl} size={20} /><span className="cc-author">u/{post.author.username}</span>
            </Link>
          )}
          <span className="cc-dot">·</span>
          <span className="cc-time" title={new Date(post.createdAt).toLocaleString(getLocale())}>{timeAgo(new Date(post.createdAt), now, t, getLocale())}</span>
          {post.tags.slice(0, 5).map((tag) => <span key={tag} className="cc-tag">{tag}</span>)}
        </div>
        <Link href={href} className="cc-link">
          <div className="feed-title">{post.title}</div>
          {post.media ? (
            <div className="cc-media">
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/media-has-caption */}
              {post.media.type === 'image' ? <img src={post.media.url} alt="" loading="lazy" /> : <video src={post.media.url} muted playsInline preload="metadata" controls />}
            </div>
          ) : post.excerpt && <p className="feed-summary">{post.excerpt}</p>}
        </Link>
        <CardActions type="post" id={post.id} href={href} title={post.title} signedIn={signedIn}
          likes={engagement.likes} liked={engagement.liked} comments={engagement.comments} reposts={engagement.reposts} reposted={engagement.reposted} />
      </div>
      <CardMenu type="post" id={post.id} signedIn={signedIn} />
    </article>
  );
}
