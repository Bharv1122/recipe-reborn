import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/header';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const dynamic = 'force-dynamic';

const SITE_NAME = 'RecipeReborn';
const SITE_DESCRIPTION =
  'Transform processed food ingredients into fresh, healthy recipes with AI-powered recipe generation. Organize recipes, create collections, and export cookbooks.';
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const metadata: Metadata = {
  metadataBase: new URL('https://recipereborn.com'),
  title: {
    default: 'RecipeReborn - Transform Processed to Fresh',
    template: '%s | RecipeReborn',
  },
  description:
    'Transform processed food ingredients into fresh, healthy recipes with AI-powered recipe generation. Organize recipes, create collections, and export cookbooks.',
  keywords: [
    'recipe generator',
    'AI recipes',
    'healthy recipes',
    'meal planning',
    'recipe collections',
    'cookbook creator',
    'dietary restrictions',
    'vegan recipes',
    'keto recipes',
    'gluten-free recipes',
  ],
  authors: [{ name: 'RecipeReborn' }],
  creator: 'RecipeReborn',
  publisher: 'RecipeReborn',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.json',
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://recipereborn.com',
    siteName: 'RecipeReborn',
    title: 'RecipeReborn - Transform Processed to Fresh',
    description:
      'Transform processed food ingredients into fresh, healthy recipes with AI-powered recipe generation. Organize recipes, create collections, and export cookbooks.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RecipeReborn - AI-Powered Recipe Generator',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RecipeReborn - Transform Processed to Fresh',
    description:
      'Transform processed food ingredients into fresh, healthy recipes with AI-powered recipe generation.',
    images: ['/og-image.png'],
    creator: '@RecipeReborn',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: SITE_NAME,
              url: 'https://recipereborn.com',
              description: SITE_DESCRIPTION,
              applicationCategory: 'FoodApplication',
              operatingSystem: 'Any',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <Header />
          <main>{children}</main>
          <Toaster position="top-center" />
        </Providers>
        <Analytics />

        {/* Google Analytics - only loads if GA_ID is set */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}