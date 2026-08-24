import { ApiError, apiRequest, apiResponse } from '@/services/api';
import type { GeneratedRecipe, Recipe, RecipeSummary } from '@/types';

export async function listRecipes() {
  return apiRequest<{ recipes: RecipeSummary[] }>('/api/mobile/recipes');
}

export async function getRecipe(id: string) {
  return apiRequest<{ recipe: Recipe }>(`/api/mobile/recipes/${encodeURIComponent(id)}`);
}

export async function saveGeneratedRecipe(originalIngredients: string, recipe: GeneratedRecipe) {
  return apiRequest<{ recipe: Recipe }>('/api/mobile/recipes', {
    method: 'POST',
    body: JSON.stringify({ originalIngredients, dietaryTags: [], ...recipe }),
  });
}

export async function generateRecipe(
  ingredients: string,
  options: { source: 'label' | 'pantry'; dietaryRestriction?: string; signal?: AbortSignal; generationId: string },
): Promise<{ generationId: string; recipe: GeneratedRecipe }> {
  const generationId = options.generationId;
  const response = await apiResponse('/api/generate-recipe', {
    method: 'POST',
    body: JSON.stringify({
      ingredients,
      source: options.source,
      dietaryRestriction: options.dietaryRestriction || undefined,
      generationId,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message || body.error || 'Recipe generation failed.', response.status);
  }

  const streamText = await response.text();
  for (const line of streamText.split('\n').reverse()) {
    if (!line.startsWith('data: ')) continue;
    let event: { status?: string; result?: GeneratedRecipe; message?: string };
    try {
      event = JSON.parse(line.slice(6));
    } catch { continue; }
    if (event.status === 'completed' && event.result) return { generationId, recipe: event.result };
    if (event.status === 'error') throw new Error(event.message || 'Recipe generation failed.');
  }
  throw new Error('Recipe generation ended before a recipe was ready.');
}

export async function cancelRecipeGeneration(generationId: string) {
  const response = await apiResponse('/api/generate-recipe/cancel', {
    method: 'POST', body: JSON.stringify({ generationId }),
  });
  if (!response.ok && response.status !== 204) throw new Error('Cancellation could not be confirmed.');
}
