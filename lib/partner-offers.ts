/**
 * Extended trials for specific communities we partner with.
 *
 * These key off the existing first-touch attribution (?src=… → localStorage →
 * User.signupSource), so a partner link needs no new URL parameter and no new
 * database column. Crucially the offer is resolved SERVER-SIDE from the stored
 * account record at checkout time, never from anything the client sends — so a
 * visitor cannot award themselves a longer trial by editing a request.
 *
 * To add a community: add an entry here and hand them
 * https://recipereborn.com/?src=<slug>
 */

/** Trial length for everyone who doesn't arrive through a partner link. */
export const DEFAULT_TRIAL_DAYS = 7;

export interface PartnerOffer {
  /** Matches ?src=<slug> and the value stored on User.signupSource. */
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
  /** After this date the link still works but reverts to the standard trial. */
  expiresAt: string;
  /**
   * Cap on how many accounts from this source get the extended trial. A month
   * of Premium is 100 AI generations, so an uncapped public link is an
   * uncapped bill. Past the cap, signups still work at the standard trial.
   */
  maxRedemptions: number;
}

export const PARTNER_OFFERS: PartnerOffer[] = [
  {
    slug: 'alexfinn',
    label: 'Alex Finn Community',
    trialDays: 30,
    // Roughly one recipe a day — an easy story to tell, and it bounds the AI
    // spend at 250 × 30 rather than 250 × 100.
    trialRecipeLimit: 30,
    expiresAt: '2026-11-14',
    maxRedemptions: 250,
  },
];

export function findPartnerOffer(slug: string | null | undefined): PartnerOffer | null {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  return PARTNER_OFFERS.find((o) => o.slug === normalized) ?? null;
}

/** An offer past its end date is inert — the link keeps working, at 7 days. */
export function isOfferLive(offer: PartnerOffer, now: Date = new Date()): boolean {
  // Compare against end-of-day UTC so the offer stays valid through its last date.
  return now.getTime() <= Date.parse(`${offer.expiresAt}T23:59:59Z`);
}
