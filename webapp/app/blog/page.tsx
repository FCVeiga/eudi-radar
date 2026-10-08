import { getT, getTSync } from '@/lib/i18n/server';

export async function generateMetadata() {
  const t = await getT();
  return {
    title: `${t('Blog')} — Tender Town`,
    robots: { index: false, follow: true },
  };
}

export default function BlogPage() {
  const t = getTSync();
  return (
    <article className="legal">
      <h1 className="opps-h1">{t('Blog')}</h1>
      <p className="muted">{t('No posts yet.')}</p>
    </article>
  );
}
