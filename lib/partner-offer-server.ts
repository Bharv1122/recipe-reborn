import { prisma } from '@/lib/db';
import {
  DEFAULT_TRIAL_DAYS,
  findPartnerOffer,
  isOfferLive,
  type PartnerOffer,
} from '@/lib/partner-offers';

/**
 * Server-side resolution of a user's trial entitlement.
 *
 * Every route that cares about trial length or trial allowance must go through
 * here, so checkout, recipe generation, recipe import, meal plans and the
 * pricing banner can never disagree about what a given account is owed.
 *
 * Never accepts anything client-supplied: the caller passes the stored account
 * record, so a visitor cannot award themselves a longer trial by editing a
 * request body or localStorage.
 */

/** Matches the standard trial cap enforced for non-partner trials. */
export const STANDARD_TRIAL_RECIPE_LIMIT = 15;

export interface ResolvedTrial {
  /** The live, in-capacity offer for this user, or null for the standard trial. */
  offer: PartnerOffer | null;
  trialDays: number;
  /** Recipes/imports allowed while status is 'trialing'. */
  trialRecipeLimit: number;
  /**
   * True when the trial should behave as real Premium: full allowance and no
   * meal-plan cap. Callers that enforce trial-only limits must check this.
   */
  fullPremium: boolean;
}

const STANDARD: ResolvedTrial = {
  offer: null,
  trialDays: DEFAULT_TRIAL_DAYS,
  trialRecipeLimit: STANDARD_TRIAL_RECIPE_LIMIT,
  fullPremium: false,
};

/**
 * Resolve the trial for an account.
 *
 * Capacity is decided by the account's POSITION in the signup queue for its
 * source rather than by a running total, so the answer for a given user is
 * stable forever: being the 40th Finnster entitles you on day 1 and still
 * entitles you after 400 more people join. A running count would silently
 * revoke an offer we had already advertised to them.
 */
export async function resolvePartnerTrial(user: {
  signupSource: string | null;
  createdAt: Date;
  subscriptionStatus?: string;
  currentPeriodEnd?: Date | null;
}): Promise<ResolvedTrial> {
  const offer = findPartnerOffer(user.signupSource);

  if (!offer || !isOfferLive(offer)) {
    return STANDARD;
  }

  if (
    offer.directAccess
    && (
      user.subscriptionStatus !== 'trialing'
      || !user.currentPeriodEnd
      || user.currentPeriodEnd.getTime() <= Date.now()
    )
  ) {
    return STANDARD;
  }

  try {
    const position = await prisma.user.count({
      where: {
        // Stored values are normalized to lowercase at signup; compare
        // insensitively anyway so any legacy mixed-case row still counts
        // toward the same cap instead of forming a second population.
        signupSource: { equals: offer.slug, mode: 'insensitive' },
        createdAt: { lte: user.createdAt },
      },
    });

    // position is 1-based and includes this user, so the Nth signup gets the
    // offer and the (N+1)th does not.
    if (position > offer.maxRedemptions) {
      return STANDARD;
    }

    return {
      offer,
      trialDays: offer.trialDays,
      trialRecipeLimit: offer.trialRecipeLimit,
      fullPremium: offer.fullPremium,
    };
  } catch (error) {
    // A database hiccup must not hand out an unbounded offer, and must not
    // break checkout either — fall back to the standard trial.
    console.error('[partner-offer] Capacity check failed:', error);
    return STANDARD;
  }
}
