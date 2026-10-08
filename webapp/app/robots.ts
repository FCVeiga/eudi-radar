import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/settings', '/api/', '/auth/'] },
    sitemap: 'https://tender-town.vercel.app/sitemap.xml',
  };
}
