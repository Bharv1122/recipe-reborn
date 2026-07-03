import type { MetadataRoute } from 'next';

const SITE_URL = 'https://recipereborn.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/account',
          '/recipes',
          '/meal-planner',
          '/shopping-lists',
          '/collections',
          '/success',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
