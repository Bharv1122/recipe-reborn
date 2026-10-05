import { z } from 'zod';
import { requiredRecipeMetadataSchema } from './recipe-metadata-validation';
import { extractJsonPayload } from './ai-json';
import { findBlockedFoodInRecipe } from './food-preferences';
import { hasMetricCookingMeasures } from '../shared/cooking-measurements';

export const recipeResultSchema = z.object({
  title: z.string().trim().min(1).max(200),
  freshIngredients: z.array(z.string().trim().min(1).max(500)).min(2).max(150),
  instructions: z.array(z.string().trim().min(1).max(3000)).min(2).max(100),
  prepTime: requiredRecipeMetadataSchema, cookTime: requiredRecipeMetadataSchema, servings: requiredRecipeMetadataSchema,
  estimatedCostPerServing: z.number().nonnegative().optional(), storeBoughtCost: z.number().nonnegative().optional(),
}).passthrough();

export type GenerationReason = 'json' | 'schema' | 'truncated' | 'metric_units' | 'allergy' | 'dislike';
export class GenerationValidationError extends Error {
  constructor(public reason: GenerationReason, public fields: string[] = []) { super(reason); }
}
export type GenerationConstraints = { us: boolean; allergies: string[]; dislikes: string[] };

export function validateGeneratedRecipe(value: unknown, constraints: GenerationConstraints) {
  const parsed = recipeResultSchema.safeParse(value);
  if (!parsed.success) throw new GenerationValidationError('schema', [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? 'recipe')))]);
  const recipe = parsed.data;
  if (constraints.us && hasMetricCookingMeasures([...recipe.freshIngredients, ...recipe.instructions])) throw new GenerationValidationError('metric_units');
  const content = { title: recipe.title, ingredients: recipe.freshIngredients, instructions: recipe.instructions };
  if (findBlockedFoodInRecipe(content, constraints.allergies, 'allergy')) throw new GenerationValidationError('allergy');
  if (findBlockedFoodInRecipe(content, constraints.dislikes, 'dislike')) throw new GenerationValidationError('dislike');
  return recipe;
}

export function parseGeneratedRecipe(content: string, finishReason: string | null, constraints: GenerationConstraints) {
  if (finishReason !== 'stop') throw new GenerationValidationError('truncated');
  let value: unknown;
  try { value = JSON.parse(extractJsonPayload(content)); }
  catch { throw new GenerationValidationError('json'); }
  return validateGeneratedRecipe(value, constraints);
}

export function generationFailureMessage(error: unknown) {
  if (error instanceof GenerationValidationError) {
    if (error.reason === 'allergy') return 'We could not make this recipe without a saved allergen. Your ingredients are still here; try another dish or substitute.';
    if (error.reason === 'dislike') return 'We could not make this recipe without an ingredient you avoid. Your input is still here; try another dish or substitute.';
    if (error.reason === 'metric_units') return 'We could not finish this recipe with U.S. cooking amounts. Your ingredients are still here. Please try again.';
    return 'The recipe response was incomplete. Your ingredients are still here. Please try again.';
  }
  return 'The recipe could not finish its ingredient checks. Your input is still here and no recipe was saved. Please try again.';
}
