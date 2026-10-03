import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hasPremiumAccess, premiumRequiredMessage } from '@/lib/entitlement';
import { getRequestUserId } from '@/lib/request-auth';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import { reserveMealPlanDraft, completeMealPlanDraft, failMealPlanDraft, getMealPlanDraft, listMealPlanDrafts, MealPlanDraftError } from '@/lib/meal-plan-drafts';
import { MODEL_FAST } from '@/lib/ai';
import { generateValidatedPlan, MealPlanSafetyError, MealPlanProviderError } from '@/lib/meal-plan-generation';
import { DEFAULT_TRIAL_DAYS } from '@/lib/partner-offers';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';
import { resolveMealPlanPreferences } from '@/lib/meal-plan-preferences';
import {
  MEAL_TYPES,
  normalizeMealTypes,
  type ValidatedDayPlan,
} from '@/lib/meal-plan-validation';

export const maxDuration = 300;

const requestSchema = z.object({
  weekStartDate: z.string().trim().min(1).refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    'Invalid week start date',
  ),
  dietaryPreferences: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  calorieTarget: z.number().int().min(500).max(10000).optional(),
  servings: z.number().int().min(1).max(8).default(2),
  allergies: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  dislikedIngredients: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  mealTypes: z.array(z.enum(MEAL_TYPES)).min(1).max(MEAL_TYPES.length),
});

// Generate a temporary preview. Saving meals or the whole plan is explicit.
export async function POST(req: Request) {
  const requestId = randomUUID();
  const startedAt = performance.now();

  let draftId: string | undefined;
  let ownerId: string | undefined;
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    ownerId = userId;
    const rateLimited = await limitAiRequest(userId);
    if (rateLimited) return rateLimited;
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) return NextResponse.json({ error: 'Invalid meal plan settings' }, { status: 400 });
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
        likedIngredients: true,
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

    if (!hasPremiumAccess(profile)) {
      return NextResponse.json(
        {
          error: 'Premium feature',
          message: profile?.subscriptionStatus === 'past_due'
            ? premiumRequiredMessage(profile, 'AI weekly meal planning')
            : `AI weekly meal plans are a Premium feature. Upgrade for $9.99/mo — ${upgradeTrialCopy}.`,
        },
        { status: 403 },
      );
    }

    // Omitted = use Account defaults; an explicit empty dislike list means a
    // one-plan override. Account allergies are always retained and may only be
    // made stricter for a plan, never silently weakened.
    const { allergies, dislikedIngredients } = resolveMealPlanPreferences(
      {
        allergies: profile?.allergies ?? [],
        dislikedIngredients: profile?.dislikedIngredients ?? [],
      },
      { allergies: allergiesOverride, dislikedIngredients: dislikesOverride },
    );
    const profileMs = Math.round(performance.now() - profileStartedAt);

    const settings = { weekStartDate, dietaryPreferences, calorieTarget, mealTypes, servings,
      allergies, dislikedIngredients, preferredIngredients: profile?.likedIngredients ?? [] };
    draftId = await reserveMealPlanDraft(userId, settings,
      profile?.subscriptionStatus === 'trialing' && !partnerTrial?.fullPremium ? 2 : null);
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
        preferredIngredients: profile?.likedIngredients ?? [],
      });
    } catch (error) {
      await failMealPlanDraft(draftId, userId);
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
        ...(error instanceof MealPlanSafetyError ? { phase: error.phase, failures: error.failures, repairFailures: error.repairFailures } : {}),
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

    const databaseStartedAt = performance.now();
    await completeMealPlanDraft(draftId, userId, generated.plan);
    const draft = await getMealPlanDraft(draftId, userId);
    const databaseMs = Math.round(performance.now() - databaseStartedAt);
    const totalMs = Math.round(performance.now() - startedAt);

    console.info('[meal-plan] completed', {
      requestId,
      mealCount: generated.plan.length * mealTypes.length,
      model: MODEL_FAST,
      attempts: generated.attempts,
      timingsMs: { profile: profileMs, ai: aiMs, database: databaseMs, total: totalMs },
    });

    return NextResponse.json({ draft }, {
      status: 201,
      headers: {
        'Server-Timing': `profile;dur=${profileMs}, ai;dur=${aiMs}, database;dur=${databaseMs}, total;dur=${totalMs}`,
      },
    });
  } catch (error) {
    if (draftId && ownerId) await failMealPlanDraft(draftId, ownerId).catch(() => {});
    if (error instanceof MealPlanDraftError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[meal-plan] failed', {
      requestId,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to generate meal plan' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ drafts: await listMealPlanDrafts(userId) }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch { return NextResponse.json({ error: 'Could not load previews. Please try again.' }, { status: 503 }); }
}
