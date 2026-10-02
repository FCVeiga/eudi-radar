import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPost } from '@/lib/social';
import UserAvatar from '@/components/UserAvatar';
import { CommentForm } from '@/components/social/PostForms';
import PostMarkdown from '@/components/social/PostMarkdown';
import HeartButton from '@/components/HeartButton';
import { getLikes } from '@/lib/likes';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function PostPage({ params }: { params: { id: string } }) {
  const [post, user] = await Promise.all([getPost(params.id), getCurrentUser()]);
  if (!post) notFound();
  const likes = await getLikes('post', [post.id]);
  return (
    <div className="post-page">
      <Link className="back-link" href="/community">← Community</Link>
      <article className="detail-block post">
        <div className="post-author">
          <UserAvatar name={post.author?.username || '?'} src={post.author?.avatarUrl} size={32} />
          {post.author ? <Link href={`/u/${post.author.username}`}>u/{post.author.username}</Link> : <span>deleted user</span>}
          <span className="profile-meta">· {fmt(post.createdAt)}</span>
        </div>
        <h1>{post.title}</h1>
        {post.tags.length > 0 && <div className="cc-tags">{post.tags.map((t) => <span key={t} className="cc-tag">{t}</span>)}</div>}
        {post.item && <Link className="post-item" href={post.item.href}><span className="feed-kind opportunity">{post.item.kind}</span>{post.item.title}</Link>}
        {post.body && <PostMarkdown>{post.body}</PostMarkdown>}
        {post.media.length > 0 && (
          <div className="post-media">
            {post.media.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/media-has-caption
              m.type === 'image' ? <img key={i} src={m.url} alt="" loading="lazy" /> : <video key={i} src={m.url} controls playsInline preload="metadata" />
            ))}
          </div>
        )}
        <div className="post-actions">
          <HeartButton type="post" id={post.id} liked={likes.liked.has(post.id)} signedIn={likes.signedIn} />
          <span>{post.likes} {post.likes === 1 ? 'like' : 'likes'}</span>
          <span>· {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}</span>
        </div>
      </article>

      <section className="detail-block">
        <h2>Comments <span className="uc-count">{post.comments.length}</span></h2>
        {user ? <CommentForm postId={post.id} /> : <p className="muted"><Link href={`/login?next=/posts/${post.id}`}>Log in</Link> to comment.</p>}
        <div className="comments">
          {post.comments.map((c) => (
            <div key={c.id} className="comment">
              <UserAvatar name={c.author?.username || '?'} src={c.author?.avatarUrl} size={28} />
              <div>
                <div className="comment-meta">{c.author ? <Link href={`/u/${c.author.username}`}>u/{c.author.username}</Link> : 'deleted user'} · {fmt(c.createdAt)}</div>
                <p>{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
