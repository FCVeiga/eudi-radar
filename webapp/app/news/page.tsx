import NewsView from '@/components/NewsView';
import { getT } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata() {
  const t = await getT();
  return pageMeta({ title: `${t('News')} — Tender Town`, description: t('Regulation, industry and market news for people who bid on public contracts.'), path: '/news' });
}

export default function NewsPage() {
  return <NewsView view="all" />;
}
