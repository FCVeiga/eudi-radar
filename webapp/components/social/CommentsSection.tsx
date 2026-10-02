import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getCommentTree } from '@/lib/comments';
import CommentThread, { CommentForm } from './CommentThread';

/** Comments block for a post or news page. */
export default async function CommentsSection({ itemType, itemId, loginNext }: { itemType: 'post' | 'news' | 'tender'; itemId: string; loginNext: string }) {
  const user = await getCurrentUser();
  const { tree, total } = await getCommentTree(itemType, itemId, user?.id ?? null);
  const item = `${itemType}:${itemId}`;
  return (
    <section className="detail-block" id="comments">
      <h2>Comments <span className="uc-count">{total}</span></h2>
      {user ? <CommentForm item={item} /> : <p className="muted"><Link href={`/login?next=${encodeURIComponent(loginNext)}`}>Log in</Link> to comment.</p>}
      {tree.length > 0 ? <CommentThread nodes={tree} item={item} signedIn={!!user} />
        : <p className="muted comments-empty">No comments yet — start the conversation.</p>}
    </section>
  );
}
