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

  async redirects() {
    return [
      // Shareable vanity links for community invites. recipereborn.com/finnsters
      // is far nicer to post than /?src=Finnsters, and lands on the same
      // attribution path. Add one line per community.
      //
      // 307 (permanent: false) on purpose: these point at a campaign that will
      // end, and a permanent redirect would be cached in browsers forever.
      {
        source: '/finnsters',
        destination: '/?src=Finnsters',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
