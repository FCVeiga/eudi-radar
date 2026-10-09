import OpportunitiesView from '@/components/OpportunitiesView';
import { getT } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata() {
  const t = await getT();
  return pageMeta({ title: `${t('New tenders')} — Tender Town`, description: t('Tenders and funding calls published in the last few days.'), path: '/tenders/new' });
}

export default function NewPage() {
  return <OpportunitiesView view="new" />;
}
