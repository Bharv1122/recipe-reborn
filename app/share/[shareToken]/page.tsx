'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, Users, ChefHat, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

interface Recipe {
  id: string;
  title: string;
  originalIngredients: string;
  freshIngredients: string;
  instructions: string;
  dietaryTags: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  viewCount: number;
  user?: {
    name?: string;
  };
}

export default function SharedRecipePage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params?.shareToken as string;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;

    const fetchRecipe = async () => {
      try {
        const response = await fetch(`/api/recipes/public/${shareToken}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Recipe not found or no longer public');
          } else {
            setError('Failed to load recipe');
          }
          return;
        }

        const data = await response.json();
        setRecipe(data.recipe);
      } catch (error) {
        console.error('Error fetching recipe:', error);
        setError('Failed to load recipe');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipe();
  }, [shareToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-white">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-0">
          <CardContent className="pt-6 text-center">
            <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error || 'Recipe Not Found'}
            </h2>
            <p className="text-gray-600 mb-6">
              This recipe may have been removed or is no longer publicly available.
            </p>
            <Button
              onClick={() => router.push('/')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const freshIngredients = JSON.parse(recipe.freshIngredients || '[]');
  const instructions = JSON.parse(recipe.instructions || '[]');

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Recipe Reborn</h1>
          <p className="text-emerald-50/90">Shared Recipe</p>
        </div>

        {/* Recipe Card */}
        <Card className="shadow-2xl border-0 bg-white">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50">
            <CardTitle className="text-3xl text-gray-900">{recipe.title}</CardTitle>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              {recipe.user?.name && (
                <span>By {recipe.user.name}</span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {recipe.viewCount} {recipe.viewCount === 1 ? 'view' : 'views'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Recipe Meta Info */}
            <div className="flex items-center gap-6 text-sm text-gray-600 flex-wrap">
              {recipe.prepTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Prep: {recipe.prepTime}</span>
                </div>
              )}
              {recipe.cookTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Cook: {recipe.cookTime}</span>
                </div>
              )}
              {recipe.servings && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Servings: {recipe.servings}</span>
                </div>
              )}
            </div>

            {/* Dietary Tags */}
            {recipe.dietaryTags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipe.dietaryTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Ingredients */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Fresh Ingredients</h2>
              <ul className="space-y-2">
                {freshIngredients.map((ingredient: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-emerald-600 mt-1">•</span>
                    <span className="text-gray-700">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Instructions</h2>
              <ol className="space-y-4">
                {instructions.map((instruction: string, index: number) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <span className="text-gray-700 pt-1">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Call to Action */}
            <div className="border-t border-gray-200 pt-6">
              <div className="bg-gradient-to-r from-emerald-50 to-orange-50 rounded-lg p-6 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Want to create your own healthy recipes?
                </h3>
                <p className="text-gray-600 mb-4">
                  Transform processed food ingredients into fresh, healthy recipes with AI
                </p>
                <Button
                  onClick={() => router.push('/signup')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Sign Up Free
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>
            Made with ❤️ by{' '}
            <button
              onClick={() => router.push('/')}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              RecipeReborn
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
