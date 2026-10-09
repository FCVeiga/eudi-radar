import NewsView from '@/components/NewsView';
import { getT } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata() {
  const t = await getT();
  return pageMeta({ title: `${t('Industry')} — Tender Town`, description: t('Industry news for people who bid on public contracts.'), path: '/news/industry' });
}

export default function IndustryNewsPage() {
  return <NewsView view="industry" />;
}
