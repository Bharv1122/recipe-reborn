import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { findPartnerOffer, isOfferLive, partnerTrialEndsAt } from '@/lib/partner-offers';
import { TESTER_REWARD_CODE, TESTER_APPROVAL_PREFIX, TESTER_REDEMPTION_PREFIX,
  TESTER_REDEMPTION_IDENTIFIER, validTesterCompletion } from '@/lib/tester-completion';

export async function redeemTesterReward(userId: string, db = prisma) {
  const offer = findPartnerOffer(TESTER_REWARD_CODE)!;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const now = new Date();
        const redeemed = await tx.verificationToken.findUnique({ where: { token: TESTER_REDEMPTION_PREFIX + userId } });
        if (redeemed) return { status: 409, error: 'This account has already redeemed its tester completion reward.' };
        if (!isOfferLive(offer, now)) return { status: 400, error: 'This tester reward offer has ended.' };
        const approval = await tx.verificationToken.findUnique({ where: { token: TESTER_APPROVAL_PREFIX + userId } });
        if (!approval || approval.expires <= now || !validTesterCompletion(approval.identifier, userId, now)) {
          return { status: 403, error: 'This reward is available after Beth confirms your completed 14-day test and feedback. Your free months have not started.' };
        }
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) return { status: 404, error: 'Account not found.' };
        // Never replace a paid subscription, permanent comp or unrelated trial.
        if (user.stripeSubscriptionId || (user.subscriptionTier !== 'free'
          && !(user.signupSource === 'playtest14' && user.subscriptionStatus === 'trialing'
            && user.currentPeriodEnd && user.currentPeriodEnd <= now))) {
          return { status: 409, error: 'Your current Premium access is still active. Contact support before redeeming this reward.' };
        }
        const taken = await tx.verificationToken.count({ where: { identifier: TESTER_REDEMPTION_IDENTIFIER } });
        if (taken >= offer.maxRedemptions) return { status: 409, error: 'The tester completion reward has reached its limit.' };
        const end = partnerTrialEndsAt(offer, now);
        await tx.verificationToken.create({ data: {
          identifier: TESTER_REDEMPTION_IDENTIFIER, token: TESTER_REDEMPTION_PREFIX + userId, expires: end,
        } });
        await tx.user.update({ where: { id: userId }, data: {
          signupSource: offer.slug, subscriptionTier: 'premium', subscriptionStatus: 'trialing',
          currentPeriodEnd: end, partnerOfferRedeemedCode: offer.slug, partnerOfferRedeemedAt: now,
          generationCount: 0, lastGenerationReset: now,
        } });
        return { status: 200, message: 'Thank you for completing the test! Two free months of Premium start now. No card or automatic charge.',
          expiresAt: end.toISOString() };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Unable to redeem tester reward.');
}
