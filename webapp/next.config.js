/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The News Report Agent reads its prompt and the company brief at runtime.
    outputFileTracingIncludes: { '/news/[id]': ['./agents/**/*.md'] },
  },
};
module.exports = nextConfig;
