import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLIC_RECIPES } from '@/lib/public-recipes';

export const metadata: Metadata = {
  title: 'Homemade Versions of Packaged Foods',
  description:
    'Simple homemade recipes that replace packaged foods: taco seasoning, ranch dressing, boxed mac and cheese, canned soup, pancake mix and more.',
  alternates: { canonical: '/homemade' },
};

export default function HomemadeIndexPage() {
  const categories = Array.from(new Set(PUBLIC_RECIPES.map((recipe) => recipe.category)));

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-sm">
            Homemade Versions of Packaged Foods
          </h1>
          <p className="mt-4 text-emerald-50/90 max-w-2xl mx-auto">
            Free recipes that swap a box, bottle or packet for fresh ingredients you can pronounce.
          </p>
        </div>

        <div className="space-y-10">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="text-2xl font-semibold text-white mb-4 drop-shadow-sm">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PUBLIC_RECIPES.filter((recipe) => recipe.category === category).map((recipe) => (
                  <Link
                    key={recipe.slug}
                    href={`/homemade/${recipe.slug}`}
                    className="block bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">{recipe.title}</h3>
                    <p className="mt-1 text-sm text-emerald-700">Replaces {recipe.replaces}</p>
                    <p className="mt-2 text-sm text-gray-600">{recipe.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Have a different product in your kitchen?</h2>
          <p className="mt-2 text-gray-700">
            Snap a photo of its ingredient label and Recipe Reborn builds the fresh version for you.
          </p>
          <Link
            href="/generator"
            className="mt-5 inline-block rounded-md bg-emerald-600 px-6 py-3 text-white font-medium hover:bg-emerald-700"
          >
            Try it free
          </Link>
        </div>
      </div>
    </div>
  );
}
