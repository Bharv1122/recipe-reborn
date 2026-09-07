import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUserId } from '@/lib/request-auth';
import { AI_API_KEY, AI_CHAT_URL, MODEL_FAST, MODEL_SMART } from '@/lib/ai';
import { validateMeal, type DayName, type MealType, type ValidatedMeal } from '@/lib/meal-plan-validation';

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

async function generateReplacement(options: {
  day: string;
  mealType: string;
  servings: number;
  allergies: string[];
  dislikedIngredients: string[];
  excludedTitles: string[];
}): Promise<ValidatedMeal | null> {
  const constraints = [
    options.allergies.length ? `Never use these allergens or their derivatives: ${options.allergies.join(', ')}.` : '',
    options.dislikedIngredients.length ? `Do not use these disliked ingredients: ${options.dislikedIngredients.join(', ')}.` : '',
    `Do not repeat any of these recipes: ${options.excludedTitles.join('; ')}.`,
  ].filter(Boolean).join('\n');
  const prompt = `Create one different ${options.mealType} recipe for ${options.day}, with exactly ${options.servings} servings.
${constraints}
Use ordinary basic ingredients and cooking steps. Do not rely on boxed mixes, seasoning packets, canned soup, jarred meal sauces, frozen meals, rotisserie chicken, ready-made dough, or other prepared shortcuts.

Return only one JSON object with title, ingredients (measured string array), instructions, prepTime, cookTime, servings, dietaryTags, and estimatedCalories.`;

  for (const model of [MODEL_FAST, MODEL_SMART]) {
    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
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
    if (!response.ok) continue;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) continue;
    try {
      const validation = validateMeal(parseMealObject(content), {
        servings: options.servings,
        allergies: options.allergies,
        dislikedIngredients: options.dislikedIngredients,
        day: options.day as DayName,
        mealType: options.mealType as MealType,
      });
      if (validation.success && !options.excludedTitles.some((title) => title.trim().toLowerCase() === validation.meal.title.trim().toLowerCase())) {
        return validation.meal;
      }
    } catch {
      // A malformed or unsafe answer is rejected before any database write.
    }
  }
  return null;
}

export async function POST(request: Request, props: { params: Promise<{ id: string; recipeId: string }> }) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AI_API_KEY) return NextResponse.json({ error: 'Recipe replacement is temporarily unavailable.' }, { status: 503 });

    const { id, recipeId } = await props.params;
    const [user, entry, titles] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { subscriptionTier: true, allergies: true, dislikedIngredients: true } }),
      prisma.mealPlanRecipe.findFirst({
        where: { id: recipeId, mealPlan: { id, userId } },
        include: { recipe: true },
      }),
      prisma.mealPlanRecipe.findMany({
        where: { mealPlan: { id, userId } },
        select: { recipe: { select: { title: true } } },
      }),
    ]);
    if (!entry || !user) return NextResponse.json({ error: 'Meal-plan recipe not found.' }, { status: 404 });
    if (user.subscriptionTier !== 'premium' && user.subscriptionTier !== 'pro') {
      return NextResponse.json({ error: 'Premium feature', message: 'Meal replacement is available with Premium.' }, { status: 403 });
    }

    const meal = await generateReplacement({
      day: entry.day,
      mealType: entry.mealType,
      servings: entry.servings,
      allergies: user.allergies,
      dislikedIngredients: user.dislikedIngredients,
      excludedTitles: titles.map(({ recipe }) => recipe.title),
    });
    if (!meal) {
      return NextResponse.json({ error: 'No safe replacement was produced. Your current meal was kept.' }, { status: 422 });
    }

    const newRecipeId = randomUUID();
    const updatedEntry = await prisma.$transaction(async (tx) => {
      await tx.recipe.create({
        data: {
          id: newRecipeId,
          userId,
          title: meal.title,
          originalIngredients: meal.ingredients.join('\n'),
          freshIngredients: meal.ingredients.join('\n'),
          instructions: meal.instructions,
          prepTime: meal.prepTime,
          cookTime: meal.cookTime,
          servings: String(meal.servings),
          dietaryTags: meal.dietaryTags,
          calories: meal.estimatedCalories,
        },
      });
      const replaced = await tx.mealPlanRecipe.updateMany({
        where: { id: entry.id, recipeId: entry.recipeId },
        data: { recipeId: newRecipeId },
      });
      if (replaced.count !== 1) throw new Error('The meal changed while a replacement was being generated.');
      return tx.mealPlanRecipe.findUnique({ where: { id: entry.id }, include: { recipe: true } });
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('[meal-replacement] failed', error);
    return NextResponse.json({ error: 'Unable to replace this meal. Your current meal was kept.' }, { status: 500 });
  }
}
