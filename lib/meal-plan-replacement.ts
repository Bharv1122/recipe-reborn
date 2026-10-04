import { recipeChat } from './ai-provider';
import { MODEL_FAST, MODEL_SMART } from './ai';
import { US_COOKING_MEASURES } from '../shared/cooking-measurements';
import { INGREDIENT_QUANTITY_RULES } from '../shared/ingredient-quantities';
import { validateMeal, type DayName, type MealType, type ValidatedMeal } from './meal-plan-validation';
import { MealPlanProviderError } from './meal-plan-generation';

// One-meal AI replacement shared by saved plans and unsaved previews, so both
// use the same prompt rules, model order, and validation.
export type ReplacementRequest = {
  day: DayName; mealType: MealType; servings: number;
  allergies: string[]; dislikedIngredients: string[];
  dietaryPreferences: string[]; preferredIngredients: string[]; excludedTitles: string[];
};

export const mealTitleKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

function parseMealObject(content: string): unknown {
  let jsonText = content.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  jsonText = fenceMatch ? fenceMatch[1] : jsonText.replace(/^```(?:json)?\s*/, '');
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start !== -1 && end > start) jsonText = jsonText.slice(start, end + 1);
  const parsed = JSON.parse(jsonText.trim());
  return parsed && typeof parsed === 'object' && 'meal' in parsed ? parsed.meal : parsed;
}

/** Returns a validated meal, or null when no safe, new recipe was produced. Provider failures throw. */
export async function generateMealReplacement(request: ReplacementRequest & { signal: AbortSignal }): Promise<ValidatedMeal | null> {
  const constraints = [
    request.allergies.length ? `Never use these allergens or their derivatives: ${request.allergies.join(', ')}.` : '',
    request.dislikedIngredients.length ? `Do not use these disliked ingredients: ${request.dislikedIngredients.join(', ')}.` : '',
    request.preferredIngredients.length ? `When practical, favor these liked ingredients without overriding exclusions: ${request.preferredIngredients.join(', ')}.` : '',
    `Do not repeat any of these recipes: ${request.excludedTitles.join('; ')}.`,
  ].filter(Boolean).join('\n');
  const prompt = `Create one different ${request.mealType} recipe for ${request.day}, with exactly ${request.servings} servings.
${constraints}
Dietary preferences: ${request.dietaryPreferences.join(', ') || 'none'}.
${US_COOKING_MEASURES}
${INGREDIENT_QUANTITY_RULES} Amounts cover all ${request.servings} serving${request.servings === 1 ? '' : 's'} together.
Use ordinary basic ingredients and cooking steps. Do not rely on boxed mixes, seasoning packets, canned soup, jarred meal sauces, frozen meals, rotisserie chicken, ready-made dough, or other prepared shortcuts.

Return only one JSON object with title, ingredients (measured string array), instructions, prepTime, cookTime, servings, dietaryTags, and estimatedCalories.`;
  const excluded = new Set(request.excludedTitles.map(mealTitleKey));

  for (const model of [MODEL_FAST, MODEL_SMART]) {
    const response = await recipeChat({
      signal: request.signal,
      method: 'POST',
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Return one safe, practical, unique home-cooking recipe as valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.45,
        max_tokens: 2200,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) throw new MealPlanProviderError(`Meal replacement provider returned status ${response.status}`, false, `http_${response.status}`);
    const data = await response.json();
    if (data.choices?.[0]?.finish_reason !== 'stop' || data.choices?.[0]?.message?.refusal) throw new MealPlanProviderError('Meal replacement was incomplete', false, 'incomplete');
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) continue;
    try {
      const validation = validateMeal(parseMealObject(content), {
        servings: request.servings, allergies: request.allergies, dislikedIngredients: request.dislikedIngredients,
        usMeasures: true, day: request.day, mealType: request.mealType,
      });
      if (validation.success && !excluded.has(mealTitleKey(validation.meal.title))) return validation.meal;
    } catch {
      // A malformed or unsafe answer is rejected before any database write.
    }
  }
  return null;
}
