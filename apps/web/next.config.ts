import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
  transpilePackages: ['@christina-crm/ui'],
};

export default nextConfig;
