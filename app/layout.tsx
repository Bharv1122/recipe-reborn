import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/header';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'https://app.recipereborn.com'),
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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXTAUTH_URL ?? 'https://app.recipereborn.com',
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
      <body className={inter.className}>
        <Providers>
          <Header />
          <main>{children}</main>
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}