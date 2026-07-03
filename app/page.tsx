import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChefHat, Sparkles, Heart, Leaf } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-orange-50">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center space-x-3 mb-6">
            <ChefHat className="h-16 w-16 text-emerald-600" />
            <h1 className="text-6xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
              RecipeReborn
            </h1>
          </div>
          <p className="text-2xl text-gray-700 max-w-3xl mx-auto">
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
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Why Choose RecipeReborn?
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white">
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
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <ChefHat className="h-6 w-6 text-emerald-600" />
              <span className="text-lg font-bold text-gray-900">RecipeReborn</span>
            </div>
            <p className="text-gray-600 text-sm">
              Transform processed food ingredients into fresh, healthy recipes with the power of AI.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/generator" className="hover:text-emerald-600">Generate Recipe</Link></li>
              <li><Link href="/recipes" className="hover:text-emerald-600">My Recipes</Link></li>
              {!session && (
                <>
                  <li><Link href="/signup" className="hover:text-emerald-600">Sign Up</Link></li>
                  <li><Link href="/login" className="hover:text-emerald-600">Sign In</Link></li>
                </>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/terms" className="hover:text-emerald-600">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-emerald-600">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-emerald-600">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t pt-8 text-center text-gray-600 text-sm">
          © {new Date().getFullYear()} RecipeReborn. All rights reserved. Transform processed to fresh.
        </div>
      </footer>
    </div>
  );
}