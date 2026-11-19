import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PUBLIC_RECIPES, getPublicRecipe, isoMinutes } from '@/lib/public-recipes';

const SITE_URL = 'https://recipereborn.com';

type PageProps = { params: Promise<{ slug: string }> };

// Only the slugs listed in PUBLIC_RECIPES exist; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLIC_RECIPES.map((recipe) => ({ slug: recipe.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getPublicRecipe(slug);
  if (!recipe) return {};

  return {
    title: recipe.title,
    description: recipe.description,
    alternates: { canonical: `/homemade/${recipe.slug}` },
    openGraph: {
      type: 'article',
      title: recipe.title,
      description: recipe.description,
      url: `${SITE_URL}/homemade/${recipe.slug}`,
    },
  };
}

export default async function PublicRecipePage({ params }: PageProps) {
  const { slug } = await params;
  const recipe = getPublicRecipe(slug);
  if (!recipe) notFound();

  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  // schema.org Recipe markup lets search engines show this as a recipe result.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.description,
    author: { '@type': 'Organization', name: 'Recipe Reborn' },
    recipeCategory: recipe.category,
    recipeYield: recipe.yield,
    prepTime: isoMinutes(recipe.prepMinutes),
    cookTime: isoMinutes(recipe.cookMinutes),
    totalTime: isoMinutes(totalMinutes),
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.steps.map((text) => ({ '@type': 'HowToStep', text })),
    url: `${SITE_URL}/homemade/${recipe.slug}`,
  };

  const related = PUBLIC_RECIPES.filter((other) => other.slug !== recipe.slug).slice(0, 3);

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-6 text-sm text-emerald-50/90">
          <Link href="/homemade" className="underline hover:text-white">
            Homemade versions
          </Link>
          <span className="mx-2">/</span>
          <span>{recipe.title}</span>
        </nav>

        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 space-y-8">
          <header>
            <p className="text-sm font-medium text-emerald-700">Replaces {recipe.replaces}</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold text-gray-900">{recipe.title}</h1>
            <p className="mt-3 text-gray-700 leading-relaxed">{recipe.description}</p>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-md bg-emerald-50 p-3">
                <dt className="text-gray-500">Prep</dt>
                <dd className="font-semibold text-gray-900">{recipe.prepMinutes} min</dd>
              </div>
              <div className="rounded-md bg-emerald-50 p-3">
                <dt className="text-gray-500">Cook</dt>
                <dd className="font-semibold text-gray-900">{recipe.cookMinutes} min</dd>
              </div>
              <div className="rounded-md bg-emerald-50 p-3">
                <dt className="text-gray-500">Makes</dt>
                <dd className="font-semibold text-gray-900">{recipe.yield}</dd>
              </div>
            </dl>
          </header>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">What the packaged version often contains</h2>
            <p className="text-gray-700 mb-3">
              Labels vary by brand, but {recipe.replaces} commonly list ingredients like these:
            </p>
            <ul className="flex flex-wrap gap-2">
              {recipe.oftenContains.map((additive) => (
                <li key={additive} className="rounded-full bg-orange-50 px-3 py-1 text-sm text-orange-800">
                  {additive}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Ingredients</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-800">
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Instructions</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-800">
              {recipe.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Tips</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-800">
              {recipe.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg bg-emerald-50 p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900">Want the fresh version of your own product?</h2>
            <p className="mt-2 text-gray-700">
              Snap a photo of any ingredient label and Recipe Reborn turns it into a homemade recipe, with vegan,
              keto and gluten-free options. Three recipes a month are free.
            </p>
            <Link
              href="/generator"
              className="mt-4 inline-block rounded-md bg-emerald-600 px-6 py-3 text-white font-medium hover:bg-emerald-700"
            >
              Transform a label free
            </Link>
          </section>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mb-4 drop-shadow-sm">More homemade versions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map((other) => (
              <Link
                key={other.slug}
                href={`/homemade/${other.slug}`}
                className="block bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow"
              >
                <p className="font-semibold text-gray-900">{other.title}</p>
                <p className="mt-1 text-sm text-emerald-700">Replaces {other.replaces}</p>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
