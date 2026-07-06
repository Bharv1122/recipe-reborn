import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Sparkles, Heart, Leaf } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { GuestScan } from './_components/guest-scan';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center space-y-8">
          <h1 className="sr-only">Recipe Reborn</h1>
          {/* Emblem: cropped to the artwork and edge-faded so it melts into the
              matching page green; the wordmark below is a transparent PNG. */}
          <div
            className="mx-auto w-full max-w-md sm:max-w-lg aspect-[4/3] overflow-hidden [mask-image:radial-gradient(ellipse_68%_75%_at_50%_50%,black_52%,transparent_78%)]"
          >
            <Image
              src="/logo.png"
              alt="Recipe Reborn — fresh vegetables bursting from a chef's hat"
              width={520}
              height={520}
              priority
              className="w-full h-auto object-cover object-top -translate-y-[2%]"
            />
          </div>
          <Image
            src="/logo-text-hero.png"
            alt=""
            aria-hidden="true"
            width={440}
            height={104}
            priority
            className="mx-auto -mt-6 w-full max-w-sm sm:max-w-md h-auto drop-shadow-md"
          />
          <p className="text-2xl text-white max-w-3xl mx-auto drop-shadow-sm">
            Transform processed food ingredients into fresh, healthy recipes with the power of AI.
          </p>
          <div className="flex items-center justify-center gap-4 pt-6">
            {session ? (
              <Link href="/generator">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Recipe
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signup">
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8">
                    Get Started
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent border-white text-white hover:bg-white hover:text-emerald-700">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Guest funnel — let anyone try the transformation before signing up */}
          {!session && (
            <div className="pt-6">
              <GuestScan />
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-white mb-12 drop-shadow-sm">
          Why Choose Recipe Reborn?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">AI-Powered Generation</h3>
            <p className="text-gray-600">
              Our advanced AI analyzes processed ingredients and creates fresh, wholesome alternatives tailored to your needs.
            </p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Heart className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Custom Dietary Options</h3>
            <p className="text-gray-600">
              Easily customize recipes to be vegan, keto, gluten-free, paleo, or low-carb with one-click transformations.
            </p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Leaf className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Fresh & Healthy</h3>
            <p className="text-gray-600">
              Every recipe uses whole, unprocessed ingredients to help you cook healthier meals for you and your family.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-emerald-600 to-orange-500 rounded-2xl shadow-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Cooking?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of home cooks who are creating healthier meals with RecipeReborn.
          </p>
          {!session && (
            <Link href="/signup">
              <Button size="lg" className="bg-white text-emerald-600 hover:bg-gray-100 text-lg px-8">
                Start Cooking Fresh Today
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 my-4 bg-white rounded-2xl shadow-2xl">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              1
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Input Ingredients</h3>
            <p className="text-gray-600">
              Copy the ingredient list from any processed food package
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              2
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate Recipe</h3>
            <p className="text-gray-600">
              Our AI creates a fresh, healthy alternative recipe
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              3
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Customize</h3>
            <p className="text-gray-600">
              Adapt to vegan, keto, gluten-free, or other dietary needs
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              4
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cook & Save</h3>
            <p className="text-gray-600">
              Follow the recipe and save favorites to your collection
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Image src="/logo-mark.png" alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
              <span className="text-lg font-bold text-white">Recipe Reborn</span>
            </div>
            <p className="text-emerald-50/90 text-sm">
              Transform processed food ingredients into fresh, healthy recipes with the power of AI.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-emerald-50/90">
              <li><Link href="/generator" className="hover:text-orange-300">Generate Recipe</Link></li>
              <li><Link href="/recipes" className="hover:text-orange-300">My Recipes</Link></li>
              {!session && (
                <>
                  <li><Link href="/signup" className="hover:text-orange-300">Sign Up</Link></li>
                  <li><Link href="/login" className="hover:text-orange-300">Sign In</Link></li>
                </>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-emerald-50/90">
              <li><Link href="/terms" className="hover:text-orange-300">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-orange-300">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-orange-300">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/20 pt-8 text-center text-emerald-50/90 text-sm">
          © {new Date().getFullYear()} Recipe Reborn. All rights reserved. Transform processed to fresh.
        </div>
      </footer>
    </div>
  );
}