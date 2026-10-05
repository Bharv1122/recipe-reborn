import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';
import { requiredRecipeMetadataSchema } from '@/lib/recipe-metadata-validation';
import { findBlockedFoodInRecipe } from '@/lib/food-preferences';
import { hasPremiumAccess } from '@/lib/entitlement';

export const GUEST_RECIPE_HANDOFF_TTL_MS = 20 * 60 * 1000;

export const guestRecipeHandoffRecipeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  freshIngredients: z.array(z.string().trim().min(1).max(500)).min(3).max(20),
  instructions: z.array(z.string().trim().min(1).max(1_000)).min(2).max(20),
  prepTime: requiredRecipeMetadataSchema,
  cookTime: requiredRecipeMetadataSchema,
  servings: requiredRecipeMetadataSchema,
  estimatedCostPerServing: z.number().nonnegative().max(100_000).optional(),
  storeBoughtCost: z.number().nonnegative().max(100_000).optional(),
}).strict();

export type GuestRecipeHandoffRecipe = z.infer<typeof guestRecipeHandoffRecipeSchema>;

const TIER_LIMITS: Record<string, number> = {
  free: 3,
  premium: 100,
  pro: Infinity,
};

export type GuestRecipeHandoffErrorCode =
  | 'invalid'
  | 'expired'
  | 'replayed'
  | 'quota'
  | 'preferences'
  | 'account';

export class GuestRecipeHandoffError extends Error {
  constructor(
    public readonly code: GuestRecipeHandoffErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GuestRecipeHandoffError';
  }
}

type HandoffDependencies = {
  db?: typeof prisma;
  now?: () => Date;
  token?: () => string;
  resolveTrial?: typeof resolvePartnerTrial;
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function quotaMessage(args: {
  tier: string;
  limit: number;
  trialing: boolean;
  partnerLabel: string | null;
}): string {
  if (args.trialing) {
    return args.partnerLabel
      ? `Your ${args.partnerLabel} free trial includes ${args.limit} recipes, and you've used them all. Subscribe to Premium for 100 a month.`
      : `Your free trial includes ${args.limit} recipes. Your full 100 per month unlocks when your trial converts to Premium.`;
  }
  return args.tier === 'free'
    ? 'You have reached your free tier limit of 3 recipes per month. Upgrade to Premium for 100 recipes per month.'
    : `You have reached your ${args.tier} tier limit of ${args.limit} recipes this month.`;
}

export async function createGuestRecipeHandoff(
  input: { originalIngredients: string; recipe: GuestRecipeHandoffRecipe },
  dependencies: HandoffDependencies = {},
) {
  const db = dependencies.db ?? prisma;
  const now = dependencies.now?.() ?? new Date();
  const token = dependencies.token?.() ?? crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + GUEST_RECIPE_HANDOFF_TTL_MS);
  const recipe = guestRecipeHandoffRecipeSchema.parse(input.recipe);

  // Opportunistic cleanup keeps raw guest inputs short-lived without making
  // the preview depend on a separate scheduled job.
  await db.guestRecipeHandoff.deleteMany({ where: { expiresAt: { lte: now } } });
  await db.guestRecipeHandoff.create({
    data: {
      tokenHash: hashToken(token),
      originalIngredients: input.originalIngredients.slice(0, 2_000),
      recipe: recipe as Prisma.InputJsonValue,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function redeemGuestRecipeHandoff(
  input: { token: string; userId: string },
  dependencies: HandoffDependencies = {},
): Promise<{ recipe: GuestRecipeHandoffRecipe; originalIngredients: string }> {
  const db = dependencies.db ?? prisma;
  const now = dependencies.now?.() ?? new Date();
  const resolveTrial = dependencies.resolveTrial ?? resolvePartnerTrial;
  const token = input.token.trim();

  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) {
    throw new GuestRecipeHandoffError('invalid', 'That recipe preview link is invalid.');
  }

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      generationCount: true,
      lastGenerationReset: true,
      signupSource: true,
      createdAt: true,
      currentPeriodEnd: true,
    },
  });
  if (!user) {
    throw new GuestRecipeHandoffError('account', 'Account not found. Please sign in again.');
  }

  const trial = await resolveTrial(user);
  const tier = hasPremiumAccess(user, now) ? user.subscriptionTier : 'free';
  const trialing = tier !== 'free' && user.subscriptionStatus === 'trialing';
  const limit = trialing
    ? trial.trialRecipeLimit
    : TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const resetBefore = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const tokenHash = hashToken(token);

  return db.$transaction(async (tx) => {
    const handoff = await tx.guestRecipeHandoff.findUnique({ where: { tokenHash } });
    if (!handoff) {
      throw new GuestRecipeHandoffError(
        'invalid',
        'That recipe preview could not be found. Your ingredients are still ready below.',
      );
    }
    const preferences = await tx.user.findUnique({
      where: { id: user.id },
      select: { allergies: true, dislikedIngredients: true },
    });
    if (!preferences) throw new GuestRecipeHandoffError('account', 'Account not found. Please sign in again.');
    const assertAllowed = (value: GuestRecipeHandoffRecipe) => {
      const content = { title: value.title, ingredients: value.freshIngredients, instructions: value.instructions };
      if (findBlockedFoodInRecipe(content, preferences.allergies, 'allergy')
        || findBlockedFoodInRecipe(content, preferences.dislikedIngredients, 'dislike')) {
        throw new GuestRecipeHandoffError('preferences', 'That preview conflicts with your saved food preferences. Generate a new recipe after signing in. No additional generation was charged.');
      }
    };
    if (handoff.redeemedAt) {
      if (handoff.redeemedByUserId === user.id && handoff.expiresAt.getTime() > now.getTime()) {
        const ownedRecipe = guestRecipeHandoffRecipeSchema.safeParse(handoff.recipe);
        if (ownedRecipe.success && handoff.originalIngredients) {
          assertAllowed(ownedRecipe.data);
          return { recipe: ownedRecipe.data, originalIngredients: handoff.originalIngredients };
        }
      }
      throw new GuestRecipeHandoffError('replayed', 'That recipe preview belongs to another account or is no longer available.');
    }
    if (handoff.expiresAt.getTime() <= now.getTime()) {
      throw new GuestRecipeHandoffError(
        'expired',
        'That recipe preview expired. Your ingredients are still ready below; choose Generate Fresh Recipe to make a new one.',
      );
    }

    const recipe = guestRecipeHandoffRecipeSchema.safeParse(handoff.recipe);
    if (!recipe.success || !handoff.originalIngredients) {
      throw new GuestRecipeHandoffError(
        'invalid',
        'That recipe preview is incomplete. Your ingredients are still ready below.',
      );
    }
    assertAllowed(recipe.data);

    // Match normal generation accounting: a 30-day rollover happens before
    // the finite allowance check. The conditional reset is safe if another
    // request already reset the same account.
    await tx.user.updateMany({
      where: { id: user.id, lastGenerationReset: { lte: resetBefore } },
      data: { generationCount: 0, lastGenerationReset: now },
    });

    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { generationCount: true },
    });
    if (!currentUser) {
      throw new GuestRecipeHandoffError('account', 'Account not found. Please sign in again.');
    }

    if (currentUser.generationCount >= limit) {
      throw new GuestRecipeHandoffError('quota', quotaMessage({
        tier: user.subscriptionTier,
        limit,
        trialing,
        partnerLabel: trial.offer?.label ?? null,
      }));
    }

    // Claim first, then charge. Either both commit or both roll back. The
    // conditional claim is the replay/concurrency guard: parallel requests can
    // never both reach a committed quota increment.
    const claimed = await tx.guestRecipeHandoff.updateMany({
      where: { id: handoff.id, redeemedAt: null, expiresAt: { gt: now } },
      data: {
        redeemedAt: now,
        redeemedByUserId: user.id,
      },
    });
    if (claimed.count !== 1) {
      // Another request may have committed while this one waited on the row.
      // Same-owner recovery is idempotent and must not charge a second slot.
      const latest = await tx.guestRecipeHandoff.findUnique({ where: { tokenHash } });
      if (
        latest?.redeemedByUserId === user.id
        && latest.expiresAt.getTime() > now.getTime()
      ) {
        const latestRecipe = guestRecipeHandoffRecipeSchema.safeParse(latest.recipe);
        if (latestRecipe.success && latest.originalIngredients) {
          assertAllowed(latestRecipe.data);
          return { recipe: latestRecipe.data, originalIngredients: latest.originalIngredients };
        }
      }
      throw new GuestRecipeHandoffError('replayed', 'That recipe preview belongs to another account or is no longer available.');
    }

    if (Number.isFinite(limit)) {
      const charged = await tx.user.updateMany({
        where: { id: user.id, generationCount: { lt: limit } },
        data: { generationCount: { increment: 1 } },
      });
      if (charged.count !== 1) {
        throw new GuestRecipeHandoffError('quota', quotaMessage({
          tier: user.subscriptionTier,
          limit,
          trialing,
          partnerLabel: trial.offer?.label ?? null,
        }));
      }
    } else {
      await tx.user.update({
        where: { id: user.id },
        data: { generationCount: { increment: 1 } },
      });
    }

    return {
      recipe: recipe.data,
      originalIngredients: handoff.originalIngredients,
    };
  });
}
