import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { tagSuggestions } from '@/lib/community';
import PostEditor from '@/components/social/PostEditor';

export const metadata = { title: 'Create a post — EUDI Radar' };

export default async function NewPostPage() {
  if (!(await getCurrentUser())) redirect('/login?next=/posts/new');
  return (
    <div className="new-post">
      <h1 className="opps-h1">Create a post</h1>
      <PostEditor suggestions={await tagSuggestions()} />
    </div>
  );
}
