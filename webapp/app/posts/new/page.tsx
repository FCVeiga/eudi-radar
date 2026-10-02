import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getFollowing } from '@/lib/profile';
import { NewPostForm } from '@/components/social/PostForms';

export const metadata = { title: 'New post — EUDI Radar' };

export default async function NewPostPage({ searchParams }: { searchParams: { item?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/posts/new');
  const following = await getFollowing(user.id);
  const items = following.map((i) => ({ value: i.key, label: `${i.kindLabel}: ${i.headline.slice(0, 90)}` }));
  const preset = items.some((i) => i.value === searchParams.item) ? searchParams.item : undefined;
  return (
    <div className="settings new-post">
      <h1 className="opps-h1">Create a post</h1>
      <section className="detail-block">
        <NewPostForm items={items} preset={preset} />
      </section>
      <p className="field-hint">Posts appear on your profile now, and in the community feed when it launches.</p>
    </div>
  );
}
