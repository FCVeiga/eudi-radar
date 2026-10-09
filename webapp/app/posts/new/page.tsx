import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { tagSuggestions } from '@/lib/community';
import PostEditor from '@/components/social/PostEditor';
import { getT } from '@/lib/i18n/server';
import { NOINDEX } from '@/lib/seo';

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t('Create a post')} — Tender Town`, ...NOINDEX };
}

export default async function NewPostPage() {
  if (!(await getCurrentUser())) redirect('/login?next=/posts/new');
  const t = await getT();
  return (
    <div className="new-post">
      <h1 className="opps-h1">{t('Create a post')}</h1>
      <PostEditor suggestions={await tagSuggestions()} />
    </div>
  );
}
