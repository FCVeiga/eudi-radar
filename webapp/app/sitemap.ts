import type { MetadataRoute } from 'next';

const BASE = 'https://tender-town.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/about', '/pricing', '/privacy', '/terms', '/help', '/tenders', '/news', '/community'];
  return paths.map((path) => ({
    url: `${BASE}${path || '/'}`,
    lastModified: new Date('2026-10-08'),
  }));
}
