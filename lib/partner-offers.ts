/**
 * Extended trials for specific communities we partner with.
 *
 * Members type a code on the signup or pricing page. A valid code is stored in
 * User.signupSource, then resolved SERVER-SIDE at checkout time. URL parameters
 * never grant an offer, so sharing an ordinary campaign link cannot unlock a
 * trial accidentally.
 */

/** Trial length for everyone who has not redeemed a community code. */
export const DEFAULT_TRIAL_DAYS = 7;

export interface PartnerOffer {
  /** Matches the typed code and the value stored on User.signupSource. */
  slug: string;
  /** Shown to the visitor so the offer is visible, not a hidden surprise. */
  label: string;
  trialDays: number;
  /**
   * Recipes included in the trial. The standard 7-day trial caps at
   * TRIAL_RECIPE_LIMIT (15), which is generous over a week but thin over a
   * month — and unlike a card-on-file trial this one never converts on its
   * own, so "the rest unlocks when you convert" is not true here. Set the
   * number the offer actually delivers and say it out loud.
   */
  trialRecipeLimit: number;
  /**
   * Give the member the real Premium experience rather than a reduced trial:
   * the full monthly recipe allowance and no meal-plan cap. The point of a
   * community offer is that they see what they would be paying for, so the
   * caps that exist to stop trial-stockpiling are lifted here.
   */
  fullPremium: boolean;
  /** After this date the link still works but reverts to the standard trial. */
  expiresAt: string;
  /**
   * Cap on how many accounts from this source get the extended trial. A month
   * of Premium is 100 AI generations, so an uncapped public link is an
   * uncapped bill. Past the cap, signups still work at the standard trial.
   *
   * REDEMPTION IS DEFINED AS SIGNUP POSITION, not trial activation: the first
   * N accounts ever created from this source are entitled, and that position
   * never changes afterwards. The alternative — counting live trials — would
   * mean someone who signed up on day one could be refused the offer weeks
   * later because other people signed up in between, after we had already
   * shown them the banner promising it. See resolvePartnerTrial().
   */
  maxRedemptions: number;
  /** Public offers may be redeemed only once by an account. */
  singleUse?: boolean;
  /**
   * A comp rather than a trial: redeeming grants Premium permanently and never
   * involves Stripe at all.
   *
   * Deliberately not implemented as a Stripe 100%-off-forever coupon. That
   * would create a real subscription that has to keep succeeding every month,
   * and a lapsed card or a webhook we miss would quietly revoke a gift. Setting
   * the tier directly means nothing can expire it: no subscription, no invoice,
   * no renewal to fail. `trialDays` is ignored for these.
   */
  lifetime?: boolean;
}

export const PARTNER_OFFERS: PartnerOffer[] = [
  {
    slug: '3dayfree',
    label: '3DAYFREE',
    trialDays: 3,
    trialRecipeLimit: 100,
    fullPremium: true,
    expiresAt: '2026-12-31',
    maxRedemptions: 1000,
    singleUse: true,
  },
  {
    // The community calls itself the Finnsters, so that is the typed code.
    // Matching is case-insensitive.
    slug: 'finnsters',
    label: 'Finnsters',
    trialDays: 30,
    // Full Premium allowance — Finnsters get the real thing for the month,
    // not a trimmed trial. Worst case is 250 × 100 generations, which the
    // redemption cap is there to bound.
    trialRecipeLimit: 100,
    fullPremium: true,
    expiresAt: '2026-11-14',
    maxRedemptions: 250,
  },
  {
    // Personal comp. maxRedemptions 1 so the code cannot be passed around,
    // and a far-future end date because the point of it is that it does not
    // run out.
    slug: 'stephanie',
    label: 'Stephanie',
    lifetime: true,
    trialDays: 0, // ignored for lifetime comps
    trialRecipeLimit: 100,
    fullPremium: true,
    expiresAt: '2099-12-31',
    maxRedemptions: 1,
  },
];

/**
 * The single normalization rule for attribution values.
 *
 * Codes and ordinary acquisition sources are normalized before storage so
 * matching and redemption limits remain case-insensitive.
 */
export function normalizeSource(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase().slice(0, 40);
  return normalized || null;
}

export function findPartnerOffer(slug: string | null | undefined): PartnerOffer | null {
  const normalized = normalizeSource(slug);
  if (!normalized) return null;
  return PARTNER_OFFERS.find((o) => o.slug === normalized) ?? null;
}

/**
 * Resolve signup attribution without allowing a URL source to redeem an offer.
 * Ordinary sources such as `fb` and `card` remain useful for analytics, while
 * `?src=Finnsters` is ignored unless Finnsters was also typed in the code box.
 */
export function resolveSignupAttribution(
  code: string | null | undefined,
  rawSource: string | null | undefined,
): { typedOffer: PartnerOffer | null; signupSource: string | null } {
  const typedOffer = findPartnerOffer(code);
  if (typedOffer) return { typedOffer, signupSource: typedOffer.slug };

  const source = normalizeSource(rawSource);
  return {
    typedOffer: null,
    signupSource: source && !findPartnerOffer(source) ? source : null,
  };
}

/** An offer past its end date is inert — the link keeps working, at 7 days. */
export function isOfferLive(offer: PartnerOffer, now: Date = new Date()): boolean {
  // Compare against end-of-day UTC so the offer stays valid through its last date.
  return now.getTime() <= Date.parse(`${offer.expiresAt}T23:59:59Z`);
}
