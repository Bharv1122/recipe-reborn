import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUserId } from '@/lib/request-auth';
import { hasRecipeAIKey } from '@/lib/ai-provider';
import { replacementSettings } from '@/lib/meal-plan-settings';
import { validateMeal, type DayName, type MealType } from '@/lib/meal-plan-validation';
import { generateMealReplacement } from '@/lib/meal-plan-replacement';
import { ENTITLEMENT_SELECT, hasPremiumAccess, premiumRequiredMessage } from '@/lib/entitlement';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import { RequestDeadlineError, withRequestDeadline } from '@/lib/request-deadline';

export const maxDuration = 60;
class ReplacementConflictError extends Error {}

export async function POST(request: Request, props: { params: Promise<{ id: string; recipeId: string }> }) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRecipeAIKey()) return NextResponse.json({ error: 'Recipe replacement is temporarily unavailable.' }, { status: 503 });

    const { id, recipeId } = await props.params;
    const [user, entry, titles] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { ...ENTITLEMENT_SELECT, allergies: true, dislikedIngredients: true, likedIngredients: true } }),
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
    if (!hasPremiumAccess(user)) {
      return NextResponse.json({ error: 'Premium feature', message: premiumRequiredMessage(user, 'Meal replacement') }, { status: 403 });
    }

    const [plan] = await prisma.$queryRaw<Array<{ generationSettings: unknown }>>`
      SELECT "generationSettings" FROM "MealPlan" WHERE id = ${id} AND "userId" = ${userId}`;
    const settings = replacementSettings(plan?.generationSettings, user);
    if (!settings) return NextResponse.json({
      error: 'This older plan has no saved food preferences. Create a new meal preview before replacing a meal. Your current meal was kept.',
    }, { status: 409 });

    const aiLimit = await limitAiRequest(userId);
    if (aiLimit) return aiLimit;
    const meal = await withRequestDeadline(request.signal, 50_000, (signal) => generateMealReplacement({
      day: entry.day as DayName,
      mealType: entry.mealType as MealType,
      servings: entry.servings,
      ...settings,
      excludedTitles: titles.map(({ recipe }) => recipe.title),
      preferredIngredients: user.likedIngredients,
      signal,
    }));
    if (!meal) {
      return NextResponse.json({ error: 'No safe replacement was produced. Your current meal was kept.' }, { status: 422 });
    }

    const newRecipeId = randomUUID();
    const updatedEntry = await prisma.$transaction(async (tx) => {
      // Account exclusions can change while the model runs. Lock and recheck
      // them before writing so a newly added allergy cannot be missed.
      const [currentProfile] = await tx.$queryRaw<Array<{ allergies: string[]; dislikedIngredients: string[] }>>`
        SELECT allergies, "dislikedIngredients" FROM "User" WHERE id = ${userId} FOR SHARE`;
      const currentSettings = currentProfile && replacementSettings(plan.generationSettings, currentProfile);
      if (!currentSettings || !validateMeal({ ...meal, ingredients: meal.ingredients }, {
        ...currentSettings, servings: entry.servings, day: entry.day as DayName,
        mealType: entry.mealType as MealType, usMeasures: true,
      }).success) throw new ReplacementConflictError();
      await tx.recipe.create({
        data: {
          id: newRecipeId,
          userId,
          savedAt: null,
          librarySource: 'meal_plan',
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
      if (replaced.count !== 1) throw new ReplacementConflictError();
      return tx.mealPlanRecipe.findUnique({ where: { id: entry.id }, include: { recipe: true } });
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    if (error instanceof ReplacementConflictError) return NextResponse.json({ error: 'Your meal or food preferences changed. Your current meal was kept; please try again.' }, { status: 409 });
    if (error instanceof RequestDeadlineError) return NextResponse.json({ error: error.message }, { status: 504 });
    console.error('[meal-replacement] failed', { kind: error instanceof Error ? error.name : 'Unknown' });
    return NextResponse.json({ error: 'Meal replacement is temporarily unavailable. Your current meal was kept. Please try again.' }, { status: 503 });
  }
}
