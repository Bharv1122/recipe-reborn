/**
 * Single server-side answer to "does this user currently get Premium?".
 *
 * The plan name alone isn't enough: a subscriber whose card failed
 * (`past_due`) or who cancelled keeps `subscriptionTier = 'premium'` in the
 * database until Stripe finishes its retries, and expired trials wait for the
 * `cron/trial-ending` job to downgrade them. Checking status and trial expiry
 * here closes that window.
 */
export interface EntitlementFields {
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd?: Date | null;
}

export const ENTITLEMENT_SELECT = {
  subscriptionTier: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
} as const;

export function hasPremiumAccess(user: EntitlementFields | null | undefined, now = new Date()): boolean {
  if (!user) return false;
  if (user.subscriptionTier !== 'premium' && user.subscriptionTier !== 'pro') return false;

  if (user.subscriptionStatus === 'active') return true;

  // Trials (Stripe or partner invite) count only until their end date.
  if (user.subscriptionStatus === 'trialing') {
    return !user.currentPeriodEnd || user.currentPeriodEnd.getTime() > now.getTime();
  }

  // past_due, canceled, or anything unexpected: no paid features until Stripe
  // reports a successful payment and the webhook sets the status back to active.
  return false;
}

export function premiumRequiredMessage(user: EntitlementFields | null | undefined, feature: string): string {
  if (user?.subscriptionStatus === 'past_due') {
    return `${feature} is paused because your last payment didn't go through. Update your card in Account to turn it back on.`;
  }
  return `${feature} is a Premium feature. Upgrade to Premium to use it.`;
}
