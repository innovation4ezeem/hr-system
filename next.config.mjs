import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // Prevent Prisma from being bundled - required for Prisma 7 compatibility
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/client/runtime/library',
    '@prisma/client/runtime/client',
    'prisma',
  ],

  productionBrowserSourceMaps: false,
  distDir: process.env.DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
    qualities: [75, 85],
  },
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: '/sign-up-login-screen',
        destination: '/',
        permanent: false,
      },
    ];
  },

  turbopack: {
    rules: {
      // Turbopack equivalent for custom loaders (currently commented out in Webpack)
      /*
      '*.{jsx,tsx}': {
        loaders: ['@dhiwise/component-tagger/nextLoader'],
        as: '*.tsx',
      },
      */
    },
    // Note: Turbopack currently handles file watching differently and doesn't 
    // support a direct equivalent to watchOptions.ignored in next.config.js yet.
  },

  webpack(
    config,
    {
      dev: dev
    }
  ) {
    /*
    config.module.rules.push({
      test: /\.(jsx|tsx)$/,
      exclude: [/node_modules/],
      use: [{
        loader: '@dhiwise/component-tagger/nextLoader',
      }],
    });
    */
    if (dev) {
      const ignoredPaths = (process.env.WATCH_IGNORED_PATHS || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      config.watchOptions = {
        ignored: ignoredPaths.length
          ? ignoredPaths.map((p) => `**/${p.replace(/^\/+|\/+$/g, '')}/**`)
          : undefined,
      };
    }
    return config;
  },
};
export default nextConfig;