import NewsView from '@/components/NewsView';
import { getT } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata() {
  const t = await getT();
  return pageMeta({ title: `${t('Market')} — Tender Town`, description: t('Market news for people who bid on public contracts.'), path: '/news/market' });
}

export default function MarketNewsPage() {
  return <NewsView view="market" />;
}
