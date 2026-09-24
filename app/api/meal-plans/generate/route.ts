import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getRequestUserId } from '@/lib/request-auth';
import { MODEL_FAST } from '@/lib/ai';
import { generateValidatedPlan, MealPlanSafetyError, MealPlanProviderError } from '@/lib/meal-plan-generation';
import { DEFAULT_TRIAL_DAYS } from '@/lib/partner-offers';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';
import {
  MEAL_TYPES,
  normalizeMealTypes,
  type ValidatedDayPlan,
} from '@/lib/meal-plan-validation';

const requestSchema = z.object({
  weekStartDate: z.string().trim().min(1).refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    'Invalid week start date',
  ),
  dietaryPreferences: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  calorieTarget: z.number().int().min(500).max(10000).optional(),
  servings: z.number().int().min(1).max(8).default(2),
  allergies: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  dislikedIngredients: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  mealTypes: z.array(z.enum(MEAL_TYPES)).min(1).max(MEAL_TYPES.length),
});

// Generate, validate, and atomically save a weekly plan.
export async function POST(req: Request) {
  const requestId = randomUUID();
  const startedAt = performance.now();

  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await req.json();
    const mealTypes = normalizeMealTypes(rawBody.mealTypes, rawBody.mealsPerDay);
    const requestResult = requestSchema.safeParse({ ...rawBody, mealTypes });
    if (!requestResult.success) {
      return NextResponse.json(
        { error: 'Invalid meal plan settings', details: requestResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const {
      weekStartDate,
      dietaryPreferences,
      calorieTarget,
      servings,
      allergies: allergiesOverride,
      dislikedIngredients: dislikesOverride,
    } = requestResult.data;

    const profileStartedAt = performance.now();
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        allergies: true,
        dislikedIngredients: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        signupSource: true,
        createdAt: true,
        currentPeriodEnd: true,
      },
    });

    const partnerTrial = profile ? await resolvePartnerTrial(profile) : null;
    const upgradeTrialCopy = partnerTrial?.offer
      ? `your ${partnerTrial.offer.label} invite includes ${partnerTrial.trialDays} days free`
      : `your first ${partnerTrial?.trialDays ?? DEFAULT_TRIAL_DAYS} days are free`;

    const tier = profile?.subscriptionTier ?? 'free';
    if (tier !== 'premium' && tier !== 'pro') {
      return NextResponse.json(
        {
          error: 'Premium feature',
          message: `AI weekly meal plans are a Premium feature. Upgrade for $9.99/mo — ${upgradeTrialCopy}.`,
        },
        { status: 403 },
      );
    }

    const TRIAL_MEAL_PLAN_LIMIT = 2;
    if (profile?.subscriptionStatus === 'trialing' && !partnerTrial?.fullPremium) {
      const planCount = await prisma.mealPlan.count({ where: { userId } });
      if (planCount >= TRIAL_MEAL_PLAN_LIMIT) {
        return NextResponse.json(
          {
            error: 'Trial limit reached',
            message: partnerTrial?.offer
              ? `Your ${partnerTrial.offer.label} free trial includes ${TRIAL_MEAL_PLAN_LIMIT} meal plans. Subscribe to Premium for unlimited plans.`
              : `Your free trial includes ${TRIAL_MEAL_PLAN_LIMIT} meal plans. Unlimited plans unlock when your trial converts to Premium.`,
          },
          { status: 403 },
        );
      }
    }

    const allergies = allergiesOverride.length > 0
      ? allergiesOverride
      : profile?.allergies ?? [];
    const dislikedIngredients = dislikesOverride.length > 0
      ? dislikesOverride
      : profile?.dislikedIngredients ?? [];
    const profileMs = Math.round(performance.now() - profileStartedAt);

    const aiStartedAt = performance.now();
    let generated: { plan: ValidatedDayPlan[]; attempts: number };
    try {
      generated = await generateValidatedPlan({
        weekStartDate,
        dietaryPreferences,
        calorieTarget,
        mealTypes,
        servings,
        allergies,
        dislikedIngredients,
      });
    } catch (error) {
      if (error instanceof MealPlanProviderError) {
        console.warn('[meal-plan] provider unavailable', {
          requestId, reason: error.message,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
        return NextResponse.json({
          error: 'Meal plan temporarily unavailable',
          message: 'The recipe service could not complete your plan. Nothing was saved. Please try again.',
        }, { status: 503 });
      }
      if (!(error instanceof MealPlanSafetyError)) throw error;

      console.warn('[meal-plan] rejected before save', {
        requestId,
        reason: error instanceof Error ? error.message : 'Unknown validation error',
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      return NextResponse.json(
        {
          error: 'Meal plan failed safety validation',
          message: 'We could not produce a plan that safely matched every meal, serving, and allergy setting. Nothing was saved. Please try again.',
        },
        { status: 422 },
      );
    }
    const aiMs = Math.round(performance.now() - aiStartedAt);

    const preparedMeals = generated.plan.flatMap((dayPlan) =>
      mealTypes.map((mealType) => ({
        day: dayPlan.day,
        mealType,
        meal: dayPlan.meals[mealType]!,
        recipeId: randomUUID(),
        relationId: randomUUID(),
      })),
    );

    const databaseStartedAt = performance.now();
    const completeMealPlan = await prisma.$transaction(async (tx) => {
      const mealPlan = await tx.mealPlan.create({
        data: {
          userId,
          name: `Meal Plan - Week of ${new Date(weekStartDate).toLocaleDateString()}`,
          weekStartDate: new Date(weekStartDate),
          description: `AI-generated meal plan. ${dietaryPreferences.length > 0 ? `Dietary preferences: ${dietaryPreferences.join(', ')}` : 'No specific dietary restrictions'}. ${calorieTarget ? `Target daily calories: ${calorieTarget}` : 'No specific calorie target'}.`,
        },
      });

      await tx.recipe.createMany({
        data: preparedMeals.map(({ meal, recipeId }) => ({
          id: recipeId,
          userId,
          title: meal.title,
          originalIngredients: meal.ingredients.join('\n'),
          freshIngredients: meal.ingredients.join('\n'),
          instructions: meal.instructions,
          prepTime: meal.prepTime,
          cookTime: meal.cookTime,
          servings: String(servings),
          dietaryTags: meal.dietaryTags.length > 0 ? meal.dietaryTags : dietaryPreferences,
          calories: meal.estimatedCalories,
        })),
      });

      await tx.mealPlanRecipe.createMany({
        data: preparedMeals.map(({ day, mealType, recipeId, relationId }) => ({
          id: relationId,
          mealPlanId: mealPlan.id,
          recipeId,
          day,
          mealType,
          servings,
          order: MEAL_TYPES.indexOf(mealType),
        })),
      });

      return tx.mealPlan.findUnique({
        where: { id: mealPlan.id },
        include: {
          mealPlanRecipes: {
            include: { recipe: true },
            orderBy: [{ day: 'asc' }, { order: 'asc' }],
          },
        },
      });
    });
    const databaseMs = Math.round(performance.now() - databaseStartedAt);
    const totalMs = Math.round(performance.now() - startedAt);

    console.info('[meal-plan] completed', {
      requestId,
      mealCount: preparedMeals.length,
      model: MODEL_FAST,
      attempts: generated.attempts,
      timingsMs: { profile: profileMs, ai: aiMs, database: databaseMs, total: totalMs },
    });

    return NextResponse.json(completeMealPlan, {
      status: 201,
      headers: {
        'Server-Timing': `profile;dur=${profileMs}, ai;dur=${aiMs}, database;dur=${databaseMs}, total;dur=${totalMs}`,
      },
    });
  } catch (error) {
    console.error('[meal-plan] failed', {
      requestId,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to generate meal plan' }, { status: 500 });
  }
}
