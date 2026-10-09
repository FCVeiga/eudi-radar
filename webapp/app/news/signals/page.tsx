import NewsView from '@/components/NewsView';
import { getT } from '@/lib/i18n/server';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata() {
  const t = await getT();
  return pageMeta({ title: `${t('Signals')} — Tender Town`, description: t('Early signals that a public buyer is preparing a procurement.'), path: '/news/signals' });
}

export default function SignalsNewsPage() {
  return <NewsView view="signals" />;
}
