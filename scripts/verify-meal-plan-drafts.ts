import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reserveMealPlanDraft, completeMealPlanDraft, failMealPlanDraft, getMealPlanDraft, saveMealPlanDraft, MealPlanDraftError, DRAFT_TTL_MS, type DraftRow } from '../lib/meal-plan-drafts';
import { DAYS, type ValidatedDayPlan } from '../lib/meal-plan-validation';
import type { GeneratePlanOptions } from '../lib/meal-plan-generation';

const settings: GeneratePlanOptions = { weekStartDate: '2026-10-05', mealTypes: ['dinner'], servings: 2, allergies: [], dislikedIngredients: [], dietaryPreferences: [] };
const meals: ValidatedDayPlan[] = DAYS.map(day => ({ day, meals: { breakfast: undefined, lunch: undefined, snack: undefined, dinner: {
  title: `${day} rice bowl`, ingredients: ['1 cup rice', '2 carrots'], instructions: 'Cook the rice in water for 20 minutes. Steam the carrots until tender and serve.',
  prepTime: '5 minutes', cookTime: '20 minutes', servings: 2, dietaryTags: [], estimatedCalories: 300,
} } }));

// Transactional fake: exercises the actual reservation/save functions with
// serialized row locks and rollback. It does not claim a live Postgres test.
function fixture() {
  let now = new Date('2026-10-03T12:00:00Z');
  let drafts = new Map<string, DraftRow>();
  let recipes = new Map<string, any>();
  let plans = new Map<string, any>();
  const profile = { allergies: [] as string[], dislikedIngredients: [] as string[] };
  let sequence = 0;
  let tail = Promise.resolve();
  const db: any = {
    $queryRaw: async (strings: TemplateStringsArray, ...args: any[]) => {
      const sql = strings.join('?');
      if (sql.includes('FROM "User"')) return [{ id: args[0] }];
      if (sql.includes('AS count')) {
        const owner = args[0], pendingCutoff = args[1];
        const used = [...drafts.values()].filter(d => d.userId === owner && (d.status === 'ready' || d.status === 'pending' && d.createdAt > pendingCutoff)).length;
        const old = 0; // Usage comes only from draft/legacy generation receipts.
        return [{ count: BigInt(used + old) }];
      }
      if (sql.includes('SELECT *')) { const row = drafts.get(args[0]); return row?.userId === args[1] ? [structuredClone(row)] : []; }
      throw new Error(`Unexpected read ${sql}`);
    },
    $executeRaw: async (strings: TemplateStringsArray, ...args: any[]) => {
      const sql = strings.join('?');
      if (sql.includes('SET "generationSettings"')) {
        const plan = plans.get(args[1]);
        assert.equal(plan.userId, args[2]);
        plan.generationSettings = JSON.parse(args[0]);
        return 1;
      }
      if (sql.includes('INSERT INTO')) {
        const [id, userId, payload, createdAt, expiresAt] = args;
        drafts.set(id, { id, userId, settings: JSON.parse(payload), createdAt, expiresAt, status: 'pending', meals: null, recipeIds: {}, savedPlanId: null }); return 1;
      }
      if (sql.includes("SET meals = NULL, settings = '{}'")) {
        for (const d of drafts.values()) if (d.userId === args[0] && d.expiresAt <= args[1]) { d.meals = null; d.settings = {} as GeneratePlanOptions; d.recipeIds = {}; }
        return 1;
      }
      if (sql.includes("status = 'ready'")) {
        const d = drafts.get(args[1]);
        if (!d || d.userId !== args[2] || d.status !== 'pending' || d.createdAt <= args[3]) return 0;
        d.meals = JSON.parse(args[0]); d.status = 'ready'; return 1;
      }
      if (sql.includes("status = 'failed'")) { const d = drafts.get(args[0]); if (d && d.userId === args[1] && d.status === 'pending') { d.status = 'failed'; d.meals = null; d.settings = {} as GeneratePlanOptions; } return 1; }
      if (sql.includes('SET "recipeIds"')) { const d = drafts.get(args[2])!; assert.equal(d.userId, args[3]); d.recipeIds = JSON.parse(args[0]); d.savedPlanId = args[1]; return 1; }
      throw new Error(`Unexpected write ${sql}`);
    },
    user: { findUnique: async () => profile },
    recipe: {
      findMany: async ({ where }: any) => [...recipes.values()].filter(r => r.userId === where.userId && where.id.in.includes(r.id) && r.savedAt),
      findFirst: async ({ where }: any) => { const r = recipes.get(where.id); return r?.userId === where.userId ? r : null; },
      create: async ({ data }: any) => { const r = { id: `recipe-${++sequence}`, ...data }; recipes.set(r.id, r); return r; },
      update: async ({ where, data }: any) => { const r = recipes.get(where.id)!; Object.assign(r, data); return r; },
    },
    mealPlan: {
      findFirst: async ({ where }: any) => { const p = plans.get(where.id); return p?.userId === where.userId ? p : null; },
      create: async ({ data }: any) => { const p = { id: `plan-${++sequence}`, ...data }; plans.set(p.id, p); return p; },
    },
    $transaction: async (fn: any) => {
      const previous = tail; let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; }); await previous;
      const snapshot = structuredClone({ drafts, recipes, plans });
      try { return await fn(db); }
      catch (error) { ({ drafts, recipes, plans } = snapshot); throw error; }
      finally { release(); }
    },
  };
  const deps = { db, now: () => now };
  return { deps, profile, drafts: () => drafts, recipes: () => recipes, plans: () => plans, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

async function main() {
  const f = fixture();
  const id = await reserveMealPlanDraft('owner', settings, 2, f.deps);
  await completeMealPlanDraft(id, 'owner', meals, f.deps);
  assert.equal(f.recipes().size, 0); assert.equal(f.plans().size, 0);
  const preview = await getMealPlanDraft(id, 'owner', f.deps);
  assert.equal(preview.days!.length, 7); assert.deepEqual(preview.savedMeals, {});
  console.log('PASS generate/preview creates no recipe or saved plan');
  await assert.rejects(getMealPlanDraft(id, 'other', f.deps), (e: any) => e.status === 404);
  await assert.rejects(saveMealPlanDraft(id, 'other', { day: 'monday', mealType: 'dinner' }, f.deps), (e: any) => e.status === 404);
  console.log('PASS cross-account preview and save denied');

  const selection = { day: 'monday' as const, mealType: 'dinner' as const };
  const [first, second] = await Promise.all([saveMealPlanDraft(id, 'owner', selection, f.deps), saveMealPlanDraft(id, 'owner', selection, f.deps)]);
  assert.equal(first.recipeId, second.recipeId); assert.equal(f.recipes().size, 1); assert.equal(f.plans().size, 0);
  assert.equal(Object.keys((await getMealPlanDraft(id, 'owner', f.deps)).savedMeals).length, 1);
  console.log('PASS duplicate meal save creates one recipe, zero plans');

  f.profile.allergies = ['rice'];
  await assert.rejects(saveMealPlanDraft(id, 'owner', { day: 'tuesday', mealType: 'dinner' }, f.deps), (e: any) => e.status === 422);
  await assert.rejects(saveMealPlanDraft(id, 'owner', undefined, f.deps), (e: any) => e.status === 422);
  assert.equal(f.recipes().size, 1); assert.equal(f.plans().size, 0);
  f.profile.allergies = [];
  f.profile.dislikedIngredients = ['carrots'];
  assert.equal((await saveMealPlanDraft(id, 'owner', selection, f.deps)).recipeId, first.recipeId, 'Completed retries must return the saved result even if preferences change');
  await assert.rejects(saveMealPlanDraft(id, 'owner', { day: 'tuesday', mealType: 'dinner' }, f.deps), (e: any) => e.status === 422);
  f.profile.dislikedIngredients = [];
  console.log('PASS current allergy/dislike changes reject save with no partial writes');

  const [whole, repeat] = await Promise.all([saveMealPlanDraft(id, 'owner', undefined, f.deps), saveMealPlanDraft(id, 'owner', undefined, f.deps)]);
  assert.equal(whole.planId, repeat.planId); assert.equal(f.plans().size, 1); assert.equal(f.recipes().size, 7);
  assert.equal([...f.recipes().values()].filter(r => r.savedAt).length, 1);
  const links = [...f.plans().values()][0].mealPlanRecipes.create;
  assert.deepEqual([...f.plans().values()][0].generationSettings, {
    allergies: settings.allergies, dislikedIngredients: settings.dislikedIngredients, dietaryPreferences: settings.dietaryPreferences,
  }, 'Saved plan must retain exclusions after the preview expires');
  assert.equal(links.length, 7); assert.equal(links[0].recipeId, first.recipeId);
  console.log('PASS explicit whole-plan save is atomic/idempotent, reuses saved meal, keeps other meals outside library');

  // Simulate removal from My recipes: reopening the preview must not say Saved.
  f.recipes().get(first.recipeId!)!.savedAt = null;
  assert.deepEqual((await getMealPlanDraft(id, 'owner', f.deps)).savedMeals, {});
  const restored = await saveMealPlanDraft(id, 'owner', selection, f.deps);
  assert.equal(restored.recipeId, first.recipeId); assert.equal(f.recipes().size, 7);
  console.log('PASS removing/re-saving a library meal retains the plan and recipe identity');

  f.plans().set('manual', { id: 'manual', userId: 'owner', name: 'Empty hand-made schedule' });
  const races = await Promise.allSettled([reserveMealPlanDraft('owner', settings, 2, f.deps), reserveMealPlanDraft('owner', settings, 2, f.deps)]);
  assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
  const reserved = races.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<string>;
  await failMealPlanDraft(reserved.value, 'owner', f.deps);
  const replacement = await reserveMealPlanDraft('owner', settings, 2, f.deps);
  assert.ok(replacement);
  f.advance(7 * 60 * 1000);
  await assert.rejects(completeMealPlanDraft(replacement, 'owner', meals, f.deps), (e: any) => e.status === 503);
  await reserveMealPlanDraft('owner', settings, 2, f.deps);
  console.log('PASS concurrent quota reservation, failed refund and abandoned pending lease');

  f.advance(DRAFT_TTL_MS);
  await assert.rejects(saveMealPlanDraft(id, 'owner', selection, f.deps), (e: any) => e.status === 410);
  await assert.rejects(getMealPlanDraft(id, 'owner', f.deps), (e: any) => e.status === 410);
  assert.equal(f.recipes().size, 7); assert.equal(f.plans().size, 2);
  const last = await reserveMealPlanDraft('owner', settings, 2, f.deps);
  await completeMealPlanDraft(last, 'owner', meals, f.deps);
  await assert.rejects(reserveMealPlanDraft('owner', settings, 2, f.deps), (e: any) => e instanceof MealPlanDraftError && e.status === 403);
  assert.equal(f.drafts().get(id)!.meals, null);
  console.log('PASS expiry/payload cleanup preserves saved content and consumed quota');

  // Live regression: account dislikes broccoli; this plan's override dislikes spinach only.
  const o = fixture();
  o.profile.dislikedIngredients = ['Broccoli'];
  const withFood = (food: string): ValidatedDayPlan[] => meals.map(d => ({ ...d, meals: { ...d.meals, dinner: { ...d.meals.dinner!, ingredients: ['1 cup rice', '2 carrots', `1 cup ${food}`] } } }));
  const overrideSettings: GeneratePlanOptions = { ...settings, dislikedIngredients: ['spinach'], accountDislikesAtCreation: ['broccoli'] };
  const overrideId = await reserveMealPlanDraft('owner', overrideSettings, null, o.deps);
  await completeMealPlanDraft(overrideId, 'owner', withFood('broccoli florets'), o.deps);
  assert.ok((await saveMealPlanDraft(overrideId, 'owner', selection, o.deps)).recipeId);
  console.log('PASS authorized one-plan dislike override saves a meal the account dislikes');

  o.profile.dislikedIngredients = ['Broccoli', 'carrots'];
  await assert.rejects(saveMealPlanDraft(overrideId, 'owner', { day: 'tuesday', mealType: 'dinner' }, o.deps), (e: any) => e.status === 422);
  await assert.rejects(saveMealPlanDraft(overrideId, 'owner', undefined, o.deps), (e: any) => e.status === 422);
  o.profile.dislikedIngredients = ['Broccoli'];
  console.log('PASS account dislike added after generation still rejects save');

  o.profile.allergies = ['broccoli'];
  await assert.rejects(saveMealPlanDraft(overrideId, 'owner', { day: 'tuesday', mealType: 'dinner' }, o.deps), (e: any) => e.status === 422);
  o.profile.allergies = [];
  console.log('PASS dislike baseline never weakens account allergies');

  const overridePlan = await saveMealPlanDraft(overrideId, 'owner', undefined, o.deps);
  assert.deepEqual(o.plans().get(overridePlan.planId!)!.generationSettings, {
    allergies: [], dislikedIngredients: ['spinach'], dietaryPreferences: [], accountDislikesAtCreation: ['broccoli'],
  }, 'Saved plan keeps the creation baseline for replacements');
  console.log('PASS whole override plan saves and stores its dislike baseline');

  const spinachId = await reserveMealPlanDraft('owner', overrideSettings, null, o.deps);
  await completeMealPlanDraft(spinachId, 'owner', withFood('spinach'), o.deps);
  await assert.rejects(saveMealPlanDraft(spinachId, 'owner', selection, o.deps), (e: any) => e.status === 422);
  const legacyId = await reserveMealPlanDraft('owner', { ...settings, dislikedIngredients: ['spinach'] }, null, o.deps);
  await completeMealPlanDraft(legacyId, 'owner', withFood('broccoli florets'), o.deps);
  await assert.rejects(saveMealPlanDraft(legacyId, 'owner', selection, o.deps), (e: any) => e.status === 422);
  console.log('PASS planned dislikes enforced; drafts without a baseline use every current account dislike');

  const route = fs.readFileSync('app/api/meal-plans/drafts/route.ts', 'utf8');
  assert.doesNotMatch(route, /(?:recipe|mealPlan|mealPlanRecipe)\.create/);
  assert.match(fs.readFileSync('app/api/meal-plans/generate/route.ts', 'utf8'), /status: 426/);
  assert.match(fs.readFileSync('app/api/meal-plans/drafts/[id]/save/route.ts', 'utf8'), /\.strict\(\)/);
  const remove = fs.readFileSync('app/api/mobile/recipes/[id]/route.ts', 'utf8').split('export async function DELETE')[1];
  assert.match(remove, /removeFromLibraryUpdate\(\)/); assert.doesNotMatch(remove, /\.delete\(/);
  console.log('PASS generation write boundary, old-client update gate, strict save input and non-destructive library removal');
  console.log('Meal draft tests passed (transactional fake; live database and phone acceptance still required).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
