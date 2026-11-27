import { ApiError, apiRequest, apiResponse } from '@/services/api';
import type { GeneratedRecipe, Recipe, RecipeSummary } from '@/types';
import type { RecipeComparisonSnapshot } from '../../../shared/recipe-comparison';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getSessionRevision, readCachedUser } from '@/services/auth-storage';
import { cacheRecipe, pruneRecipeCache, readCachedRecipes, recipeCacheRevision } from '@/services/recipe-cache';

async function cacheSession(db: SQLiteDatabase) {
  const revision = getSessionRevision();
  const cacheRevision = recipeCacheRevision(db);
  const owner = (await readCachedUser())?.id;
  const current = () => revision === getSessionRevision() && cacheRevision === recipeCacheRevision(db);
  return { owner, cacheRevision, current };
}
function canReadOffline(error: unknown) {
  return error instanceof TypeError || (error instanceof ApiError && error.status >= 500);
}
export async function listRecipesWithCache(db: SQLiteDatabase) {
  const session = await cacheSession(db);
  let result: { recipes: RecipeSummary[] };
  try { result = await listRecipes(); }
  catch (error) {
    if (!session.owner || !session.current() || !canReadOffline(error)) throw error;
    const recipes = await readCachedRecipes(db, session.owner);
    if (!session.current()) throw error;
    return { recipes, offline: true };
  }
  if (session.owner) await pruneRecipeCache(db, session.owner, result.recipes.map(recipe => recipe.id), session.cacheRevision, session.current).catch(() => undefined);
  return { ...result, offline: false };
}
export async function getRecipeWithCache(db: SQLiteDatabase, id: string) {
  const session = await cacheSession(db);
  let result: { recipe: Recipe };
  try { result = await getRecipe(id); }
  catch (error) {
    if (!session.owner || !session.current() || !canReadOffline(error)) throw error;
    const recipe = (await readCachedRecipes(db, session.owner)).find(item => item.id === id);
    if (!recipe || !session.current()) throw error;
    return { recipe, offline: true };
  }
  if (session.owner) await cacheRecipe(db, session.owner, result.recipe, session.cacheRevision, session.current).catch(() => undefined);
  return { ...result, offline: false };
}

export async function listRecipes() {
  return apiRequest<{ recipes: RecipeSummary[] }>('/api/mobile/recipes');
}

export async function getRecipe(id: string) {
  return apiRequest<{ recipe: Recipe }>(`/api/mobile/recipes/${encodeURIComponent(id)}`);
}

export async function saveGeneratedRecipe(originalIngredients: string, recipe: GeneratedRecipe, comparisonSnapshot?: RecipeComparisonSnapshot) {
  return apiRequest<{ recipe: Recipe }>('/api/mobile/recipes', {
    method: 'POST',
    body: JSON.stringify({ originalIngredients, dietaryTags: [], ...recipe, comparisonSnapshot, librarySource: 'generated' }),
  });
}

export async function generateRecipe(
  ingredients: string,
  options: { source: 'label' | 'pantry' | 'dish' | 'random'; productName?: string; pantryTargetTitle?: string; dietaryRestriction?: string; signal?: AbortSignal; generationId: string },
): Promise<{ generationId: string; recipe: GeneratedRecipe }> {
  const generationId = options.generationId;
  const response = await apiResponse('/api/generate-recipe', {
    method: 'POST',
    body: JSON.stringify({
      ingredients,
      measurementSystem: 'us',
      source: options.source,
      productName: options.productName,
      pantryTargetTitle: options.pantryTargetTitle,
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
