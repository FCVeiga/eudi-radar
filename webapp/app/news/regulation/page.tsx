import NewsView from '@/components/NewsView';
import { getT } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata() {
  const t = await getT();
  return pageMeta({ title: `${t('Regulation')} — Tender Town`, description: t('Regulation news for people who bid on public contracts.'), path: '/news/regulation' });
}

export default function RegulationNewsPage() {
  return <NewsView view="regulation" />;
}
