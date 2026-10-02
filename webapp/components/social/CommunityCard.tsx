import Link from 'next/link';
import HeartButton from '@/components/HeartButton';
import UserAvatar from '@/components/UserAvatar';
import { timeAgo } from '@/lib/feed';
import type { PostCard } from '@/lib/community';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A post in the Community Feed: score and heart on the left, like the home feed's cards. */
export default function CommunityCard({ post, now, liked, signedIn }: { post: PostCard; now: Date; liked: boolean; signedIn: boolean }) {
  const why = `Score ${post.score}: relevance ${pct(post.parts.relevance)}, following ${post.parts.following ? 'yes' : 'no'}, likes ${post.likes}, recency ${pct(post.parts.recency)}`;
  return (
    <div className="likeable community-card-wrap">
      <Link href={`/posts/${post.id}`} className="feed-item community-card">
        <div className="feed-votes cc-score" title={why}>
          <span className="feed-votes-num">{post.score}</span>
          <span className="cc-score-label">score</span>
        </div>
        <div className="feed-body">
          <div className="feed-meta">
            {post.author && <><UserAvatar name={post.author.username} src={post.author.avatarUrl} size={20} /><span className="cc-author">u/{post.author.username}</span></>}
            <span className="feed-time" title={new Date(post.createdAt).toLocaleString('en-GB')}>{timeAgo(new Date(post.createdAt), now)}</span>
          </div>
          <div className="feed-title">{post.title}</div>
          {post.tags.length > 0 && <div className="cc-tags">{post.tags.slice(0, 5).map((t) => <span key={t} className="cc-tag">{t}</span>)}</div>}
          {post.media ? (
            <div className="cc-media">
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/media-has-caption */}
              {post.media.type === 'image' ? <img src={post.media.url} alt="" loading="lazy" /> : <video src={post.media.url} muted playsInline preload="metadata" controls />}
            </div>
          ) : post.excerpt && <p className="feed-summary">{post.excerpt}</p>}
          <div className="cc-stats">
            <span>{post.likes} {post.likes === 1 ? 'like' : 'likes'}</span>
            <span>{post.comments} {post.comments === 1 ? 'comment' : 'comments'}</span>
          </div>
        </div>
      </Link>
      <HeartButton type="post" id={post.id} liked={liked} signedIn={signedIn} className="cc-heart" />
    </div>
  );
}
