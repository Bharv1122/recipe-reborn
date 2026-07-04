/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets CI-style verification builds run alongside a dev server without
  // fighting over .next (Windows: concurrent writes corrupt the build).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
