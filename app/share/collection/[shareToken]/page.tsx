'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChefHat, Clock, Eye, Loader2, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SharedRecipe {
  id: string;
  title: string;
  freshIngredients: string;
  instructions: string;
  dietaryTags: string[];
  prepTime?: string | null;
  cookTime?: string | null;
  servings?: string | null;
  rating?: number | null;
}

interface SharedCollection {
  name: string;
  description?: string | null;
  viewCount: number;
  user?: { name?: string | null } | null;
  collectionRecipes: Array<{ recipe: SharedRecipe }>;
}

function toList(value: string): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // Older recipes may contain newline-separated values.
    }
  }
  return trimmed.split('\n').map((item) => item.trim()).filter(Boolean);
}

export default function SharedCollectionPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params?.shareToken as string;
  const [collection, setCollection] = useState<SharedCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!shareToken) return;

    const loadCollection = async () => {
      try {
        const response = await fetch(`/api/collections/public/${shareToken}`);
        if (!response.ok) {
          setError(
            response.status === 404
              ? 'Collection not found or no longer public'
              : 'Failed to load collection'
          );
          return;
        }
        setCollection(await response.json());
      } catch (loadError) {
        console.error('Error fetching shared collection:', loadError);
        setError('Failed to load collection');
      } finally {
        setIsLoading(false);
      }
    };

    loadCollection();
  }, [shareToken]);

  const recipes = collection?.collectionRecipes?.map((entry) => entry.recipe) ?? [];

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-200 mx-auto mb-4" />
          <p>Loading collection...</p>
        </div>
      </main>
    );
  }

  if (error || !collection) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-0">
          <CardContent className="pt-6 text-center">
            <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {error || 'Collection Not Found'}
            </h1>
            <p className="text-gray-600 mb-6">
              This collection may have been removed or is no longer publicly available.
            </p>
            <Button onClick={() => router.push('/')} className="bg-emerald-600 hover:bg-emerald-700">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="text-center text-white">
          <p className="text-emerald-100 font-medium mb-2">Recipe Reborn collection</p>
          <h1 className="text-3xl sm:text-4xl font-bold">{collection.name}</h1>
          {collection.description && (
            <p className="mt-3 text-emerald-50/90 max-w-2xl mx-auto">{collection.description}</p>
          )}
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-emerald-50/90">
            {collection.user?.name && <span>By {collection.user.name}</span>}
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {collection.viewCount + 1} {collection.viewCount + 1 === 1 ? 'view' : 'views'}
            </span>
          </div>
        </header>

        {recipes.length === 0 ? (
          <Card className="border-0 shadow-xl">
            <CardContent className="py-12 text-center text-gray-600">
              This collection does not contain any recipes yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {recipes.map((recipe) => {
              const ingredients = toList(recipe.freshIngredients);
              const instructions = toList(recipe.instructions);

              return (
                <Card key={recipe.id} className="border-0 shadow-xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50">
                    <CardTitle className="text-2xl text-gray-900">{recipe.title}</CardTitle>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {recipe.prepTime && (
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />Prep: {recipe.prepTime}</span>
                      )}
                      {recipe.cookTime && (
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />Cook: {recipe.cookTime}</span>
                      )}
                      {recipe.servings && (
                        <span className="flex items-center gap-1"><Users className="h-4 w-4" />Serves {recipe.servings}</span>
                      )}
                      {recipe.rating && (
                        <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{recipe.rating}/5</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {recipe.dietaryTags?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {recipe.dietaryTags.map((tag) => (
                          <span key={tag} className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <section>
                      <h2 className="text-lg font-semibold text-gray-900 mb-2">Fresh Ingredients</h2>
                      <ul className="space-y-1.5 text-gray-700">
                        {ingredients.map((ingredient, index) => (
                          <li key={`${recipe.id}-ingredient-${index}`} className="flex gap-2">
                            <span className="text-emerald-600" aria-hidden="true">•</span>
                            <span>{ingredient}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h2 className="text-lg font-semibold text-gray-900 mb-2">Instructions</h2>
                      <ol className="space-y-3 text-gray-700">
                        {instructions.map((instruction, index) => (
                          <li key={`${recipe.id}-instruction-${index}`} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span>{instruction}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="border-0 shadow-xl">
          <CardContent className="py-7 text-center">
            <h2 className="text-xl font-semibold text-gray-900">Create your own fresh recipe collection</h2>
            <p className="text-gray-600 mt-2 mb-4">Turn a packaged ingredient list into a homemade recipe and keep your favorites together.</p>
            <Button onClick={() => router.push('/signup')} className="bg-emerald-600 hover:bg-emerald-700">
              Try Recipe Reborn Free
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
