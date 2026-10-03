/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets CI-style verification builds run alongside a dev server without
  // fighting over .next (Windows: concurrent writes corrupt the build).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  turbopack: { root: __dirname },
  outputFileTracingIncludes: { '/api/plugin/mcp': ['./plugins/recipe-reborn/ui/panel.html'] },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
