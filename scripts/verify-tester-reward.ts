import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '@prisma/client';
import { findPartnerOffer, partnerTrialEndsAt } from '../lib/partner-offers';
import { validTesterCompletion, TESTER_APPROVAL_PREFIX, TESTER_REDEMPTION_PREFIX } from '../lib/tester-completion';
import { redeemTesterReward } from '../lib/tester-reward-server';

const offer = findPartnerOffer(' TESTERTHANKS ')!;
assert.equal(partnerTrialEndsAt(offer, new Date('2026-12-31T12:34:56Z')).toISOString(), '2027-02-28T12:34:56.000Z');
assert.equal(partnerTrialEndsAt(offer, new Date('2028-12-31T12:34:56Z')).toISOString(), '2029-02-28T12:34:56.000Z');
assert.equal(partnerTrialEndsAt(offer, new Date('2026-10-08T12:34:56Z')).toISOString(), '2026-12-08T12:34:56.000Z');
const now = new Date();
const completed = new Date(now.getTime() - 1000);
const approval = { userId: 'tester', startedAt: new Date(completed.getTime() - 14 * 86400000).toISOString(),
  completedAt: completed.toISOString(), approvedAt: completed.toISOString(), feedbackReference: 'test-report-1', approvedBy: 'Beth' };
assert(validTesterCompletion(JSON.stringify(approval), 'tester', now));
assert(!validTesterCompletion(JSON.stringify(approval), 'other', now));
for (const change of [ { feedbackReference: '' }, { approvedBy: 'tester' }, { completedAt: approval.startedAt },
  { approvedAt: new Date(now.getTime() + 1000).toISOString() }, { startedAt: 'invalid' } ]) {
  assert(!validTesterCompletion(JSON.stringify({ ...approval, ...change }), 'tester', now));
}
assert(!validTesterCompletion('invalid JSON', 'tester', now));

async function main() {
  let approved = false, used = false, capacity = 0, writes = 0, retries = 0;
  let user = { subscriptionTier: 'free', subscriptionStatus: 'active', signupSource: 'playtest14',
    stripeSubscriptionId: null as string | null, currentPeriodEnd: null as Date | null };
  let updated: Record<string, unknown> = {};
  const tx = {
    verificationToken: {
      findUnique: async ({ where }: { where: { token: string } }) => where.token.startsWith(TESTER_REDEMPTION_PREFIX)
        ? used ? { expires: now } : null : where.token.startsWith(TESTER_APPROVAL_PREFIX) && approved
          ? { identifier: JSON.stringify(approval), expires: new Date('2028-01-01') } : null,
      count: async () => capacity,
      create: async () => { used = true; writes++; },
    },
    user: { findUnique: async () => user, update: async ({ data }: { data: Record<string, unknown> }) => { updated = data; writes++; } },
  };
  const db = { $transaction: async (run: (t: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, 'Serializable');
    if (retries++ === 0) throw new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' });
    return run(tx);
  } } as unknown as PrismaClient;
  assert.equal((await redeemTesterReward('tester', db)).status, 403);
  assert.equal(writes, 0);
  approved = true;
  user.stripeSubscriptionId = 'paid';
  assert.equal((await redeemTesterReward('tester', db)).status, 409);
  assert.equal(writes, 0);
  user.stripeSubscriptionId = null;
  capacity = 25;
  assert.equal((await redeemTesterReward('tester', db)).status, 409);
  assert.equal(writes, 0);
  capacity = 0;
  user = { ...user, subscriptionTier: 'premium', subscriptionStatus: 'trialing', currentPeriodEnd: new Date(now.getTime() - 1000) };
  const result = await redeemTesterReward('tester', db);
  assert.equal(result.status, 200);
  assert.equal(updated.subscriptionTier, 'premium');
  assert.equal(updated.generationCount, 0);
  assert.equal(updated.stripeSubscriptionId, undefined);
  assert.equal((updated.currentPeriodEnd as Date).toISOString(), partnerTrialEndsAt(offer, updated.partnerOfferRedeemedAt as Date).toISOString());
  assert.equal((await redeemTesterReward('tester', db)).status, 409);
  assert.equal(writes, 2);
  console.log('Tester reward checks passed: approval/14-day gate, account binding, calendar months, prior tester trial, paid-plan protection, capacity, retries and replay prevention.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
