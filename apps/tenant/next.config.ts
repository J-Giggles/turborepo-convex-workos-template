import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  cacheComponents: true,
  transpilePackages: ['@repo/ui'],
};

export default config;
