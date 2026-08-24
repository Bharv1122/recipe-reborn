import { randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';
import { DEFAULT_TRIAL_DAYS } from '@/lib/partner-offers';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';
import {
  DAYS,
  MEAL_TYPES,
  normalizeMealTypes,
  parseMealPlanContent,
  validateMealPlan,
  type MealType,
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

interface GeneratePlanOptions {
  weekStartDate: string;
  dietaryPreferences: string[];
  calorieTarget?: number;
  mealTypes: MealType[];
  servings: number;
  allergies: string[];
  dislikedIngredients: string[];
}

class MealPlanSafetyError extends Error {
  constructor() {
    super('The generated meal plan failed safety validation twice.');
    this.name = 'MealPlanSafetyError';
  }
}

function buildPrompt(options: GeneratePlanOptions): string {
  const dietaryInfo = options.dietaryPreferences.length > 0
    ? `Dietary preferences: ${options.dietaryPreferences.join(', ')}`
    : 'No specific dietary restrictions';
  const calorieInfo = options.calorieTarget
    ? `Target daily calories across the selected meals: ${options.calorieTarget}`
    : 'No specific calorie target';
  const allergyInfo = options.allergies.length > 0
    ? `FOOD ALLERGIES: ${options.allergies.join(', ')}. Never include these allergens, their derivatives, sauces, stocks, seasonings, or cross-named ingredients. Do not mention an allergen even in a "free-from" ingredient label; choose an unambiguous alternative instead.`
    : 'No food allergies were supplied';
  const dislikeInfo = options.dislikedIngredients.length > 0
    ? `Disliked ingredients: ${options.dislikedIngredients.join(', ')}. Avoid them and use alternatives.`
    : 'No disliked ingredients were supplied';
  const mealKeys = options.mealTypes.join(', ');
  const mealTemplate = options.mealTypes.map((mealType) => `
    "${mealType}": {
      "title": "Recipe name",
      "ingredients": ["measured ingredient 1", "measured ingredient 2"],
      "instructions": "Concise step-by-step instructions",
      "prepTime": "10 min",
      "cookTime": "20 min",
      "servings": ${options.servings},
      "dietaryTags": ["tag"],
      "estimatedCalories": 450
    }`).join(',');

  return `Create one practical seven-day meal plan.

Requirements:
- Week starting: ${new Date(options.weekStartDate).toLocaleDateString()}
- ${dietaryInfo}
- ${calorieInfo}
- Exact meal types for every day: ${mealKeys}
- Exactly ${options.mealTypes.length} meals per day and ${DAYS.length * options.mealTypes.length} meals total
- Exactly ${options.servings} serving${options.servings === 1 ? '' : 's'} per recipe
- ${allergyInfo}
- ${dislikeInfo}
- Use varied, achievable home-cooking recipes with measured ingredient quantities
- Keep instructions concise but complete to reduce waiting time

Return only a valid JSON array with exactly seven objects, Monday through Sunday. Each day must contain "day" plus exactly these meal keys: ${mealKeys}. Never add breakfast, lunch, dinner, or snack unless it is in that exact list.

[
  {
    "day": "monday",${mealTemplate}
  }
]

Repeat that exact structure for all seven days. Do not include markdown or prose.`;
}

async function requestMealPlan(prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch(AI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_FAST,
      messages: [
        {
          role: 'system',
          content: 'Return only valid JSON. Follow meal counts, servings, and allergy exclusions exactly.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.35,
      max_tokens: Math.min(12000, Math.max(5000, maxTokens)),
    }),
  });

  if (!response.ok) {
    throw new Error(`Meal-plan model request failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Meal-plan model returned no content');
  }
  if (data.choices?.[0]?.finish_reason === 'length') {
    throw new Error('Meal-plan model response was truncated');
  }

  return content;
}

async function generateValidatedPlan(
  options: GeneratePlanOptions,
): Promise<{ plan: ValidatedDayPlan[]; attempts: number }> {
  const basePrompt = buildPrompt(options);
  const maxTokens = DAYS.length * options.mealTypes.length * 350;
  let retryReasons: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const retryInstruction = retryReasons.length > 0
      ? `\n\nYour previous response was rejected. Correct every issue and generate the full plan again:\n${retryReasons.slice(0, 12).map((reason) => `- ${reason}`).join('\n')}`
      : '';
    const content = await requestMealPlan(`${basePrompt}${retryInstruction}`, maxTokens);

    let parsed: unknown;
    try {
      parsed = parseMealPlanContent(content);
    } catch {
      retryReasons = ['Return parseable JSON with one complete array and no surrounding text.'];
      continue;
    }

    const validation = validateMealPlan(parsed, {
      mealTypes: options.mealTypes,
      servings: options.servings,
      allergies: options.allergies,
    });
    if (validation.success) return { plan: validation.plan, attempts: attempt };

    retryReasons = validation.errors.map((error) => error.message);
  }

  throw new MealPlanSafetyError();
}

// Generate, validate, and atomically save a weekly plan.
export async function POST(req: Request) {
  const requestId = randomUUID();
  const startedAt = performance.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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
      where: { id: session.user.id },
      select: {
        allergies: true,
        dislikedIngredients: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        signupSource: true,
        createdAt: true,
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
      const planCount = await prisma.mealPlan.count({ where: { userId: session.user.id } });
      if (planCount >= TRIAL_MEAL_PLAN_LIMIT) {
        return NextResponse.json(
          {
            error: 'Trial limit reached',
            message: partnerTrial?.offer
              ? `Your ${partnerTrial.offer.label} trial includes ${TRIAL_MEAL_PLAN_LIMIT} meal plans. Subscribe to Premium for unlimited plans.`
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
          userId: session.user.id,
          name: `Meal Plan - Week of ${new Date(weekStartDate).toLocaleDateString()}`,
          weekStartDate: new Date(weekStartDate),
          description: `AI-generated meal plan. ${dietaryPreferences.length > 0 ? `Dietary preferences: ${dietaryPreferences.join(', ')}` : 'No specific dietary restrictions'}. ${calorieTarget ? `Target daily calories: ${calorieTarget}` : 'No specific calorie target'}.`,
        },
      });

      await tx.recipe.createMany({
        data: preparedMeals.map(({ meal, recipeId }) => ({
          id: recipeId,
          userId: session.user.id,
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
