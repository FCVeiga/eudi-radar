import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPost } from '@/lib/social';
import UserAvatar from '@/components/UserAvatar';
import { CommentForm } from '@/components/social/PostForms';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function PostPage({ params }: { params: { id: string } }) {
  const [post, user] = await Promise.all([getPost(params.id), getCurrentUser()]);
  if (!post) notFound();
  return (
    <div className="post-page">
      <article className="detail-block post">
        <div className="post-author">
          <UserAvatar name={post.author?.username || '?'} src={post.author?.avatarUrl} size={32} />
          {post.author ? <Link href={`/u/${post.author.username}`}>u/{post.author.username}</Link> : <span>deleted user</span>}
          <span className="profile-meta">· {fmt(post.createdAt)}</span>
        </div>
        <h1>{post.title}</h1>
        {post.item && <Link className="post-item" href={post.item.href}><span className="feed-kind opportunity">{post.item.kind}</span>{post.item.title}</Link>}
        {post.body && <div className="post-body">{post.body}</div>}
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
