/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The News Report Agent reads its prompt and the company brief at runtime.
    // So do the Tender Evaluation Agent (tender pages).
    outputFileTracingIncludes: { '/news/[id]': ['./agents/**/*.md'], '/tenders/[id]': ['./agents/**/*.md'], '/settings': ['./agents/**/*.md'] },
  },
  // Old paths (shared links, bookmarks) keep working.
  async redirects() {
    return [
      { source: '/opportunities/signals', destination: '/news/signals', permanent: true },
      { source: '/opportunities', destination: '/tenders', permanent: true },
      { source: '/opportunities/:path*', destination: '/tenders/:path*', permanent: true },
      { source: '/database', destination: '/history', permanent: true },
      { source: '/landscape', destination: '/settings', permanent: false },
    ];
  },
};
module.exports = nextConfig;
