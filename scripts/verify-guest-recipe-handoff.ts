import assert from 'node:assert/strict';
import {
  GUEST_RECIPE_HANDOFF_TTL_MS,
  GuestRecipeHandoffError,
  createGuestRecipeHandoff,
  redeemGuestRecipeHandoff,
  type GuestRecipeHandoffRecipe,
} from '../lib/guest-recipe-handoff';
import fs from 'node:fs';
import path from 'node:path';

const recipe: GuestRecipeHandoffRecipe = {
  title: 'Exact Preview Soup',
  freshIngredients: ['2 carrots', '1 onion', '3 cups stock'],
  instructions: ['Chop the vegetables.', 'Simmer until tender.'],
  prepTime: '10 minutes',
  cookTime: '20 minutes',
  servings: '4',
  estimatedCostPerServing: 1.25,
  storeBoughtCost: 2.5,
};

type HandoffRow = {
  id: string;
  tokenHash: string;
  originalIngredients: string | null;
  recipe: unknown;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedByUserId: string | null;
  createdAt: Date;
};

function makeDb(generationCount = 0) {
  const handoffs = new Map<string, HandoffRow>();
  const user = {
    id: 'user-1', subscriptionTier: 'free', subscriptionStatus: 'active', generationCount,
    lastGenerationReset: new Date('2026-10-01T00:00:00Z'), signupSource: null,
    createdAt: new Date('2026-09-01T00:00:00Z'), currentPeriodEnd: null,
  };
  const otherUser = {
    ...user,
    id: 'user-2',
    generationCount: 0,
  };
  const users = new Map([[user.id, user], [otherUser.id, otherUser]]);
  let nextId = 1;
  let transactionTail = Promise.resolve();

  const client: any = {
    guestRecipeHandoff: {
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [key, row] of handoffs) {
          if (row.expiresAt <= where.expiresAt.lte) { handoffs.delete(key); count += 1; }
        }
        return { count };
      },
      create: async ({ data }: any) => {
        const row: HandoffRow = {
          id: `handoff-${nextId++}`,
          tokenHash: data.tokenHash,
          originalIngredients: data.originalIngredients,
          recipe: data.recipe,
          expiresAt: data.expiresAt,
          redeemedAt: null,
          redeemedByUserId: null,
          createdAt: new Date('2026-10-01T00:00:00Z'),
        };
        handoffs.set(row.tokenHash, row);
        return row;
      },
      findUnique: async ({ where }: any) => handoffs.get(where.tokenHash) ?? null,
      updateMany: async ({ where, data }: any) => {
        const row = [...handoffs.values()].find((candidate) => candidate.id === where.id);
        if (!row || row.redeemedAt || row.expiresAt <= where.expiresAt.gt) return { count: 0 };
        row.redeemedAt = data.redeemedAt;
        row.redeemedByUserId = data.redeemedByUserId;
        return { count: 1 };
      },
    },
    user: {
      findUnique: async ({ where, select }: any) => {
        const selectedUser = users.get(where.id);
        if (!selectedUser) return null;
        return Object.fromEntries(Object.keys(select).map((key) => [key, (selectedUser as any)[key]]));
      },
      updateMany: async ({ where, data }: any) => {
        const selectedUser = users.get(where.id);
        if (!selectedUser) return { count: 0 };
        if (where.lastGenerationReset?.lte && selectedUser.lastGenerationReset > where.lastGenerationReset.lte) return { count: 0 };
        if (where.generationCount?.lt !== undefined && selectedUser.generationCount >= where.generationCount.lt) return { count: 0 };
        if (data.generationCount === 0) selectedUser.generationCount = 0;
        if (data.generationCount?.increment) selectedUser.generationCount += data.generationCount.increment;
        if (data.lastGenerationReset) selectedUser.lastGenerationReset = data.lastGenerationReset;
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const selectedUser = users.get(where.id);
        if (!selectedUser) throw new Error('missing user');
        selectedUser.generationCount += data.generationCount.increment;
        return selectedUser;
      },
    },
  };
  client.$transaction = async (callback: (tx: any) => Promise<any>) => {
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const snapshot = {
      userCounts: new Map([...users].map(([id, value]) => [id, value.generationCount])),
      rows: new Map([...handoffs].map(([key, value]) => [key, { ...value }])),
    };
    try {
      return await callback(client);
    } catch (error) {
      for (const [id, count] of snapshot.userCounts) users.get(id)!.generationCount = count;
      handoffs.clear();
      for (const [key, value] of snapshot.rows) handoffs.set(key, value);
      throw error;
    } finally {
      release();
    }
  };

  return { client, user, otherUser, handoffs };
}

const standardTrial = async () => ({ offer: null, trialDays: 7, trialRecipeLimit: 15, fullPremium: false });
const at = (iso: string) => () => new Date(iso);

async function expectCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) =>
    error instanceof GuestRecipeHandoffError && error.code === code);
}

async function main() {
  const first = makeDb();
  const created = await createGuestRecipeHandoff(
    { originalIngredients: 'carrots, onion, stock', recipe },
    { db: first.client, now: at('2026-10-01T01:00:00Z'), token: () => 'a'.repeat(43) },
  );
  const unlocked = await redeemGuestRecipeHandoff(
    { token: created.token, userId: first.user.id },
    { db: first.client, now: at('2026-10-01T01:01:00Z'), resolveTrial: standardTrial as any },
  );
  assert.deepEqual(unlocked.recipe, recipe, 'The server must return the exact preview recipe.');
  assert.equal(first.user.generationCount, 1, 'A successful unlock charges exactly one slot.');
  const recovered = await redeemGuestRecipeHandoff(
    { token: created.token, userId: first.user.id },
    { db: first.client, now: at('2026-10-01T01:02:00Z'), resolveTrial: standardTrial as any },
  );
  assert.deepEqual(recovered.recipe, recipe, 'A response-loss retry returns the exact recipe.');
  assert.equal(first.user.generationCount, 1, 'A same-owner retry must not charge again.');
  await expectCode(redeemGuestRecipeHandoff(
    { token: created.token, userId: first.otherUser.id },
    { db: first.client, now: at('2026-10-01T01:03:00Z'), resolveTrial: standardTrial as any },
  ), 'replayed');
  assert.equal(first.otherUser.generationCount, 0, 'A different account must not receive or pay for the claimed recipe.');

  const parallel = makeDb();
  const parallelCreated = await createGuestRecipeHandoff(
    { originalIngredients: 'carrots, onion, stock', recipe },
    { db: parallel.client, now: at('2026-10-01T02:00:00Z'), token: () => 'b'.repeat(43) },
  );
  const attempts = await Promise.allSettled([1, 2].map(() => redeemGuestRecipeHandoff(
    { token: parallelCreated.token, userId: parallel.user.id },
    { db: parallel.client, now: at('2026-10-01T02:01:00Z'), resolveTrial: standardTrial as any },
  )));
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 2);
  for (const result of attempts) {
    if (result.status === 'fulfilled') assert.deepEqual(result.value.recipe, recipe);
  }
  assert.equal(parallel.user.generationCount, 1, 'Parallel unlocks must commit one charge.');

  const full = makeDb(3);
  const fullCreated = await createGuestRecipeHandoff(
    { originalIngredients: 'carrots, onion, stock', recipe },
    { db: full.client, now: at('2026-10-01T03:00:00Z'), token: () => 'c'.repeat(43) },
  );
  await expectCode(redeemGuestRecipeHandoff(
    { token: fullCreated.token, userId: full.user.id },
    { db: full.client, now: at('2026-10-01T03:01:00Z'), resolveTrial: standardTrial as any },
  ), 'quota');
  assert.equal(full.user.generationCount, 3);
  assert.equal([...full.handoffs.values()][0].redeemedAt, null, 'Quota rejection leaves the token unclaimed.');

  const expired = makeDb();
  const expiredCreated = await createGuestRecipeHandoff(
    { originalIngredients: 'carrots, onion, stock', recipe },
    { db: expired.client, now: at('2026-10-01T04:00:00Z'), token: () => 'd'.repeat(43) },
  );
  await expectCode(redeemGuestRecipeHandoff(
    { token: expiredCreated.token, userId: expired.user.id },
    { db: expired.client, now: () => new Date(Date.parse('2026-10-01T04:00:00Z') + GUEST_RECIPE_HANDOFF_TTL_MS + 1), resolveTrial: standardTrial as any },
  ), 'expired');
  assert.equal(expired.user.generationCount, 0);

  await expectCode(redeemGuestRecipeHandoff(
    { token: 'not-a-token', userId: expired.user.id },
    { db: expired.client, now: at('2026-10-01T04:01:00Z'), resolveTrial: standardTrial as any },
  ), 'invalid');

  const generatorSource = fs.readFileSync(path.join(process.cwd(), 'app/generator/_components/recipe-generator.tsx'), 'utf8');
  assert.match(generatorSource, /\/api\/guest\/handoff\/redeem/);
  assert.doesNotMatch(generatorSource, /generateRecipe\(undefined,\s*stashed/);
  assert.match(generatorSource, /exact recipe you previewed/);

  console.log('Guest recipe handoff verification passed: exact recipe, response-loss retry, account ownership, single charge, parallel claim, quota, expiry, invalid token, and client no-regeneration path.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
