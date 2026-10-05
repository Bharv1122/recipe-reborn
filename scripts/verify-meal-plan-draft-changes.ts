import assert from 'node:assert/strict';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import {
  reserveMealPlanDraft, completeMealPlanDraft, getMealPlanDraft, saveMealPlanDraft, changeMealPlanDraftMeal, parseDraftMealChange,
  DRAFT_TTL_MS, type DraftRow, type MealReplacer,
} from '../lib/meal-plan-drafts';
import type { ReplacementRequest } from '../lib/meal-plan-replacement';
import { DAYS, MEAL_INSTRUCTIONS_MAX_CHARS, validateMeal, type ValidatedDayPlan, type ValidatedMeal } from '../lib/meal-plan-validation';
import type { GeneratePlanOptions } from '../lib/meal-plan-generation';

// Offline: transactional fake with serialized row locks and rollback, plus the
// route's auth/strict-payload gates. No database, AI provider, or secrets.
const settings: GeneratePlanOptions = { weekStartDate: '2026-10-05', mealTypes: ['dinner'], servings: 2, allergies: ['peanut'],
  dislikedIngredients: ['spinach'], dietaryPreferences: ['vegetarian'], preferredIngredients: ['carrots'], accountDislikesAtCreation: [] };
const dinner = (title: string, extra: Partial<ValidatedMeal> = {}): ValidatedMeal => ({ title, ingredients: ['1 cup rice', '2 carrots'],
  instructions: 'Cook the rice in water for 20 minutes. Steam the carrots until tender and serve.', prepTime: '5 minutes', cookTime: '20 minutes',
  servings: 2, dietaryTags: [], estimatedCalories: 300, ...extra });
const meals: ValidatedDayPlan[] = DAYS.map(day => ({ day, meals: { breakfast: undefined, lunch: undefined, snack: undefined, dinner: dinner(`${day} rice bowl`) } }));
const monday = { day: 'monday' as const, mealType: 'dinner' as const };
const expected = (meal: ValidatedMeal) => ({ title: meal.title, ingredients: meal.ingredients, instructions: meal.instructions,
  prepTime: meal.prepTime, cookTime: meal.cookTime, servings: meal.servings, dietaryTags: meal.dietaryTags });
// What the phone's RecipeDetail sends back for a meal (importDraft + importSnapshot, one line per step).
const clientEdit = (meal: ValidatedMeal) => ({ title: meal.title, freshIngredients: meal.ingredients,
  instructions: meal.instructions.split(/\r?\n/).map(line => line.trim()).filter(Boolean),
  prepTime: meal.prepTime, cookTime: meal.cookTime, servings: String(meal.servings), dietaryTags: meal.dietaryTags });

function fixture() {
  let now = new Date('2026-10-03T12:00:00Z');
  let drafts = new Map<string, DraftRow>();
  let recipes = new Map<string, any>();
  let plans = new Map<string, any>();
  const profile = { allergies: [] as string[], dislikedIngredients: [] as string[] };
  const writes = { recipe: 0, plan: 0 };
  let sequence = 0;
  let tail = Promise.resolve();
  const db: any = {
    $queryRaw: async (strings: TemplateStringsArray, ...args: any[]) => {
      const sql = strings.join('?');
      if (sql.includes('FOR SHARE')) return [structuredClone(profile)];
      if (sql.includes('FROM "User"')) return [{ id: args[0] }];
      if (sql.includes('AS count')) return [{ count: BigInt([...drafts.values()].filter(d => d.userId === args[0] && d.status === 'ready').length) }];
      if (sql.includes('SELECT *')) { const row = drafts.get(args[0]); return row?.userId === args[1] ? [structuredClone(row)] : []; }
      throw new Error(`Unexpected read ${sql}`);
    },
    $executeRaw: async (strings: TemplateStringsArray, ...args: any[]) => {
      const sql = strings.join('?');
      if (sql.includes('"savedPlanId" IS NULL')) {
        assert.doesNotMatch(sql, /settings/, 'Meal changes never rewrite plan settings (servings stay fixed)');
        const d = drafts.get(args[2]);
        if (!d || d.userId !== args[3] || d.savedPlanId) return 0;
        d.meals = JSON.parse(args[0]); d.recipeIds = JSON.parse(args[1]); return 1;
      }
      if (sql.includes('SET "generationSettings"')) { plans.get(args[1]).generationSettings = JSON.parse(args[0]); return 1; }
      if (sql.includes('INSERT INTO')) {
        const [id, userId, payload, createdAt, expiresAt] = args;
        drafts.set(id, { id, userId, settings: JSON.parse(payload), createdAt, expiresAt, status: 'pending', meals: null, recipeIds: {}, savedPlanId: null }); return 1;
      }
      if (sql.includes("SET meals = NULL, settings = '{}'")) return 0;
      if (sql.includes("status = 'ready'")) { const d = drafts.get(args[1])!; d.meals = JSON.parse(args[0]); d.status = 'ready'; return 1; }
      if (sql.includes('SET "recipeIds"')) { const d = drafts.get(args[2])!; d.recipeIds = JSON.parse(args[0]); d.savedPlanId = args[1]; return 1; }
      throw new Error(`Unexpected write ${sql}`);
    },
    user: { findUnique: async () => structuredClone(profile) },
    recipe: {
      findMany: async ({ where }: any) => [...recipes.values()].filter(r => r.userId === where.userId && where.id.in.includes(r.id) && r.savedAt),
      findFirst: async ({ where }: any) => { const r = recipes.get(where.id); return r?.userId === where.userId && (!where.savedAt || r.savedAt) ? r : null; },
      create: async ({ data }: any) => { writes.recipe++; const r = { id: `recipe-${++sequence}`, ...data }; recipes.set(r.id, r); return r; },
      update: async ({ where, data }: any) => { writes.recipe++; const r = recipes.get(where.id)!; Object.assign(r, data); return r; },
    },
    mealPlan: {
      findFirst: async ({ where }: any) => { const p = plans.get(where.id); return p?.userId === where.userId ? p : null; },
      create: async ({ data }: any) => { writes.plan++; const p = { id: `plan-${++sequence}`, ...data }; plans.set(p.id, p); return p; },
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
  const create = async () => { const id = await reserveMealPlanDraft('owner', settings, null, deps); await completeMealPlanDraft(id, 'owner', meals, deps); return id; };
  const slotMeal = (id: string, day = 'monday') => drafts.get(id)!.meals!.find(d => d.day === day)!.meals.dinner!;
  return { deps, profile, writes, create, slotMeal, drafts: () => drafts, recipes: () => recipes, plans: () => plans,
    advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

const replacer = (meal: ValidatedMeal | null, seen: ReplacementRequest[] = []): MealReplacer => async request => { seen.push(request); return meal; };
const edit = (meal: Partial<ValidatedMeal>) => ({ kind: 'edit' as const, meal: { ...dinner('Monday carrot fried rice'), ...meal } });
const status = (code: number) => (error: any) => { assert.equal(error.status, code, error.message); return true; };

async function main() {
  const f = fixture();
  const id = await f.create();
  const original = f.slotMeal(id);

  await assert.rejects(changeMealPlanDraftMeal(id, 'intruder', { slot: monday, expectedMeal: expected(original), change: edit({}) }, {}, f.deps), status(404));
  assert.deepEqual(f.slotMeal(id), original);
  console.log('PASS other accounts cannot see or change a preview');

  // An existing saved copy stays in My recipes; the slot is unlinked.
  const saved = await saveMealPlanDraft(id, 'owner', monday, f.deps);
  const writesBefore = { ...f.writes };
  const edited = await changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(original), change: edit({ dietaryTags: ['vegetarian'] }) }, {}, f.deps);
  assert.equal(edited.days![0].meals.dinner!.title, 'Monday carrot fried rice');
  assert.equal(edited.days![0].meals.dinner!.estimatedCalories, 300);
  assert.deepEqual(edited.savedMeals, {}); assert.deepEqual(f.drafts().get(id)!.recipeIds, {});
  assert.ok(f.recipes().get(saved.recipeId!)!.savedAt, 'Previously saved meal stays in the library');
  assert.equal(f.recipes().get(saved.recipeId!)!.title, original.title);
  assert.deepEqual(f.writes, writesBefore, 'Changing a preview writes no Recipe or MealPlan rows');
  assert.equal(f.plans().size, 0);
  console.log('PASS edit changes only the preview, keeps the saved library copy, and unlinks the slot');

  const current = f.slotMeal(id);
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(original), change: edit({ title: 'Stale' }) }, {}, f.deps), status(409));
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: { day: 'monday', mealType: 'lunch' }, expectedMeal: expected(current), change: edit({}) }, {}, f.deps), status(404));
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(current), change: edit({ ingredients: ['1 cup rice', '2 tbsp peanut butter'] }) }, {}, f.deps), status(422));
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(current), change: edit({ ingredients: ['1 cup rice', '2 cups spinach'] }) }, {}, f.deps), status(422));
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(current), change: edit({ servings: 4 }) }, {}, f.deps), status(422));
  f.profile.allergies = ['sesame'];
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(current), change: edit({ ingredients: ['1 cup rice', '1 tbsp sesame oil'] }) }, {}, f.deps), status(422));
  f.profile.allergies = [];
  assert.deepEqual(f.slotMeal(id), current);
  console.log('PASS stale, missing, unsafe (plan + current account), and wrong-serving edits are rejected unchanged');

  const seen: ReplacementRequest[] = [];
  f.profile.allergies = ['sesame'];
  const swapped = await changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(current), change: { kind: 'replace' } },
    { replace: replacer(dinner('Lentil tomato stew'), seen) }, f.deps);
  f.profile.allergies = [];
  assert.equal(swapped.days![0].meals.dinner!.title, 'Lentil tomato stew');
  assert.deepEqual(seen[0].allergies, ['peanut', 'sesame']); assert.deepEqual(seen[0].dislikedIngredients, ['spinach']);
  assert.deepEqual(seen[0].dietaryPreferences, ['vegetarian']); assert.deepEqual(seen[0].preferredIngredients, ['carrots']);
  assert.equal(seen[0].servings, 2); assert.ok(seen[0].excludedTitles.includes(current.title) && seen[0].excludedTitles.includes('tuesday rice bowl'));
  assert.deepEqual(f.writes, writesBefore);
  console.log('PASS replace uses original plan settings plus current allergies/dislikes and writes only the preview');

  const afterSwap = f.slotMeal(id);
  for (const [label, replace] of [
    ['no safe meal', replacer(null)],
    ['unsafe meal', replacer(dinner('Peanut noodles', { ingredients: ['8 oz noodles', '3 tbsp peanut butter'] }))],
    ['duplicate title', replacer(dinner('Tuesday rice bowl'))],
  ] as const) await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(afterSwap), change: { kind: 'replace' } }, { replace }, f.deps), (e: any) => [409, 422].includes(e.status) || assert.fail(label));
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(afterSwap), change: { kind: 'replace' } },
    { replace: async () => { throw new Error('provider down'); } }, f.deps), /provider down/);
  // Allergy added on another device while the model ran: rechecked under lock.
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(afterSwap), change: { kind: 'replace' } },
    { replace: async () => { f.profile.allergies = ['lentil']; return dinner('Lentil curry'); } }, f.deps), status(409));
  f.profile.allergies = [];
  assert.deepEqual(f.slotMeal(id), afterSwap); assert.deepEqual(f.writes, writesBefore);
  console.log('PASS failed, unsafe, duplicate, provider-error, and preference-race replacements keep the old meal');

  // Two devices change the same meal at once: exactly one wins.
  let open!: () => void; const gate = new Promise<void>(resolve => { open = resolve; });
  const slow: MealReplacer = async () => { await gate; return dinner('Black bean tacos'); };
  const race = Promise.allSettled([
    changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(afterSwap), change: { kind: 'replace' } }, { replace: slow }, f.deps),
    changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(afterSwap), change: edit({ title: 'Carrot rice pilaf' }) }, {}, f.deps),
  ]);
  await new Promise(resolve => setTimeout(resolve, 10)); open();
  const results = await race;
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.status, 409);
  assert.equal(f.slotMeal(id).title, 'Carrot rice pilaf');
  console.log('PASS concurrent changes: one wins, the stale one gets 409');

  // The service itself refuses a "replacement" that repeats the current meal or
  // another plan meal, whatever the generator returned.
  const t = fixture(); const tId = await t.create(); const tOriginal = t.slotMeal(tId);
  for (const title of [tOriginal.title, '  MONDAY   Rice bowl ', 'Tuesday rice bowl']) {
    await assert.rejects(changeMealPlanDraftMeal(tId, 'owner', { slot: monday, expectedMeal: expected(tOriginal), change: { kind: 'replace' } },
      { replace: replacer(dinner(title)) }, t.deps), status(422));
  }
  assert.deepEqual(t.slotMeal(tId), tOriginal);
  console.log('PASS replacement equal to the original (or another plan meal) is rejected by the service, not just the generator');

  // No per-preview replacement cap; plan settings (servings) never change.
  const settingsBefore = structuredClone(t.drafts().get(tId)!.settings);
  for (let n = 1; n <= 12; n++) {
    const next = await changeMealPlanDraftMeal(tId, 'owner', { slot: monday, expectedMeal: expected(t.slotMeal(tId)), change: { kind: 'replace' } },
      { replace: replacer(dinner(`Swap number ${n}`)) }, t.deps);
    assert.equal(next.servings, 2); assert.equal(next.days![0].meals.dinner!.servings, 2);
  }
  assert.deepEqual(t.drafts().get(tId)!.settings, settingsBefore);
  await assert.rejects(changeMealPlanDraftMeal(tId, 'owner', { slot: monday, expectedMeal: expected(t.slotMeal(tId)), change: { kind: 'replace' } },
    { replace: replacer(dinner('Four serving soup', { servings: 4 })) }, t.deps), status(422));
  assert.equal(t.slotMeal(tId).title, 'Swap number 12');
  console.log('PASS 12 consecutive replacements allowed (no invented cap); servings and plan settings stay fixed');

  // dietaryTags are part of the concurrency check when the client echoes them.
  const tagged = t.slotMeal(tId);
  await assert.rejects(changeMealPlanDraftMeal(tId, 'owner', { slot: monday, expectedMeal: { ...expected(tagged), dietaryTags: ['vegan'] }, change: edit({ title: 'Tag race' }) }, {}, t.deps), status(409));
  const { dietaryTags: _omit, ...withoutTags } = expected(tagged);
  await changeMealPlanDraftMeal(tId, 'owner', { slot: monday, expectedMeal: withoutTags, change: edit({ title: 'Old client edit', dietaryTags: ['vegetarian'] }) }, {}, t.deps);
  await assert.rejects(changeMealPlanDraftMeal(tId, 'owner', { slot: monday, expectedMeal: { ...expected(t.slotMeal(tId)), dietaryTags: [] }, change: edit({ title: 'Stale tags' }) }, {}, t.deps), status(409));
  // Meals stored without a dietaryTags field compare as [].
  delete (t.drafts().get(tId)!.meals![0].meals.dinner as Partial<ValidatedMeal>).dietaryTags;
  const legacy = t.slotMeal(tId);
  await assert.rejects(changeMealPlanDraftMeal(tId, 'owner', { slot: monday, expectedMeal: { ...expected(legacy), dietaryTags: ['vegetarian'] }, change: edit({ title: 'Legacy race' }) }, {}, t.deps), status(409));
  await changeMealPlanDraftMeal(tId, 'owner', { slot: monday, expectedMeal: { ...expected(legacy), dietaryTags: [] }, change: edit({ title: 'Legacy edit' }) }, {}, t.deps);
  assert.equal(t.slotMeal(tId).title, 'Legacy edit');
  console.log('PASS dietaryTags mismatch is a 409; omitted tags (old clients) and tagless stored meals compare consistently');

  // Opening a meal and applying without changes is a no-op, even though the
  // editor drops blank lines and indentation, so the saved-recipe link stays.
  const r = fixture(); const rId = await r.create();
  r.drafts().get(rId)!.meals![0].meals.dinner!.instructions = 'Rinse the rice.\n\n   Simmer the rice for 20 minutes.\nSteam the carrots and serve.';
  const linked = await saveMealPlanDraft(rId, 'owner', monday, r.deps);
  const stored = r.slotMeal(rId);
  const roundTrip = parseDraftMealChange({ ...monday, kind: 'edit', expectedMeal: expected(stored), recipe: clientEdit(stored) })!;
  const same = await changeMealPlanDraftMeal(rId, 'owner', roundTrip, {}, r.deps);
  assert.equal(same.savedMeals['monday:dinner'], linked.recipeId);
  assert.deepEqual(r.slotMeal(rId), stored);
  console.log('PASS unchanged round-trip edit keeps stored text and the saved-recipe link');

  // Long single-paragraph instructions (as generated) round-trip through the
  // array-based edit snapshot; the joined total shares the stored bound.
  const paragraph = 'Stir the rice gently and keep cooking. '.repeat(300).slice(0, MEAL_INSTRUCTIONS_MAX_CHARS - 1) + '.';
  assert.equal(paragraph.length, MEAL_INSTRUCTIONS_MAX_CHARS);
  r.drafts().get(rId)!.meals![1].meals.dinner!.instructions = paragraph;
  const tuesday = { day: 'tuesday' as const, mealType: 'dinner' as const };
  const long = r.slotMeal(rId, 'tuesday');
  assert.ok(validateMeal(long, { servings: 2, allergies: [] }).success, 'an 8000-character stored paragraph is a valid meal');
  const longEdit = parseDraftMealChange({ ...tuesday, kind: 'edit', expectedMeal: expected(long), recipe: clientEdit(long) });
  assert.ok(longEdit, 'unchanged 8000-character instructions are not rejected as a one-item array');
  await changeMealPlanDraftMeal(rId, 'owner', longEdit!, {}, r.deps);
  const retitled = parseDraftMealChange({ ...tuesday, kind: 'edit', expectedMeal: expected(long), recipe: { ...clientEdit(long), title: 'Long stirred rice' } })!;
  await changeMealPlanDraftMeal(rId, 'owner', retitled, {}, r.deps);
  assert.equal(r.slotMeal(rId, 'tuesday').title, 'Long stirred rice'); assert.equal(r.slotMeal(rId, 'tuesday').instructions, paragraph);
  const after = r.slotMeal(rId, 'tuesday');
  assert.equal(parseDraftMealChange({ ...tuesday, kind: 'edit', expectedMeal: expected(after), recipe: { ...clientEdit(after), instructions: [paragraph, 'Serve.'] } }), null, 'joined total over the bound is a 400');
  assert.equal(parseDraftMealChange({ ...tuesday, kind: 'replace', expectedMeal: { ...expected(after), instructions: paragraph + 'x' } }), null);
  assert.ok(parseDraftMealChange({ ...tuesday, kind: 'edit', expectedMeal: expected(after), recipe: { ...clientEdit(after), instructions: Array(30).fill('Stir the rice.') } }));
  // Generated step arrays share the same joined bound, so every stored meal fits the edit/echo limits.
  assert.equal(validateMeal({ ...dinner('Too long'), instructions: Array(30).fill('Stir. '.repeat(166)) }, { servings: 2, allergies: [] }).success, false);
  assert.ok(validateMeal({ ...dinner('Steps'), instructions: Array(30).fill('Stir the rice.') }, { servings: 2, allergies: [] }).success);
  console.log('PASS 8000-character paragraph edits are accepted; joined instruction totals are bounded at 8000 everywhere');

  // Explicit save stores the new content; the old library copy stays.
  const resaved = await saveMealPlanDraft(id, 'owner', monday, f.deps);
  assert.notEqual(resaved.recipeId, saved.recipeId);
  assert.equal(f.recipes().get(resaved.recipeId!)!.title, 'Carrot rice pilaf');
  assert.ok(f.recipes().get(saved.recipeId!)!.savedAt);
  // Change racing a whole-plan save: the save wins, so the change is refused.
  const latest = f.slotMeal(id);
  const [plan, late] = await Promise.allSettled([
    saveMealPlanDraft(id, 'owner', undefined, f.deps),
    changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(latest), change: edit({ title: 'Too late' }) }, {}, f.deps),
  ]);
  assert.equal(plan.status, 'fulfilled'); assert.equal(late.status, 'rejected');
  const planId = (plan as PromiseFulfilledResult<{ planId?: string | null }>).value.planId!;
  assert.equal((late as PromiseRejectedResult).reason.status, 409);
  assert.equal((late as PromiseRejectedResult).reason.details.savedPlanId, planId);
  const link = f.plans().get(planId).mealPlanRecipes.create.find((entry: any) => entry.day === 'monday');
  assert.equal(link.recipeId, resaved.recipeId);
  await assert.rejects(changeMealPlanDraftMeal(id, 'owner', { slot: monday, expectedMeal: expected(latest), change: { kind: 'replace' } }, { replace: replacer(dinner('Never')) }, f.deps),
    (e: any) => e.status === 409 && e.details.savedPlanId === planId);
  assert.equal(f.slotMeal(id).title, 'Carrot rice pilaf');
  console.log('PASS explicit save writes edited content; saved plan refuses changes and points to the saved plan');

  // Edit racing a whole-plan save the other way round: the plan gets the edit.
  const e = fixture(); const editFirst = await e.create();
  const [changed, wholePlan] = await Promise.all([
    changeMealPlanDraftMeal(editFirst, 'owner', { slot: monday, expectedMeal: expected(e.slotMeal(editFirst)), change: edit({}) }, {}, e.deps),
    new Promise(resolve => setTimeout(resolve, 5)).then(() => saveMealPlanDraft(editFirst, 'owner', undefined, e.deps)),
  ]);
  assert.equal(changed.days![0].meals.dinner!.title, 'Monday carrot fried rice');
  const firstLink = e.plans().get(wholePlan.planId!).mealPlanRecipes.create.find((entry: any) => entry.day === 'monday');
  assert.equal(e.recipes().get(firstLink.recipeId).title, 'Monday carrot fried rice');
  console.log('PASS an edit committed before saving is what the saved plan contains');

  const x = fixture(); const expiring = await x.create(); const before = x.slotMeal(expiring);
  x.advance(DRAFT_TTL_MS);
  await assert.rejects(changeMealPlanDraftMeal(expiring, 'owner', { slot: monday, expectedMeal: expected(before), change: { kind: 'replace' } }, { replace: replacer(dinner('Never')) }, x.deps), status(410));
  await assert.rejects(changeMealPlanDraftMeal(expiring, 'owner', { slot: monday, expectedMeal: expected(before), change: edit({}) }, {}, x.deps), status(410));
  assert.deepEqual(x.slotMeal(expiring), before); assert.equal(x.writes.recipe + x.writes.plan, 0);
  console.log('PASS expired previews refuse changes');

  // Nutrition calculated by RecipeDetail travels with the exact edited meal.
  const estimate = { calories: 410, protein: 12.5, carbs: 70, fat: 8, fiber: 0, sodium: null, perServing: true as const, accuracy: 'estimated' as const,
    basisLabel: 'Per recipe serving (recipe makes 2)', sourceLabel: 'Estimated from the generated recipe' };
  const n = fixture(); const nId = await n.create(); const nOriginal = n.slotMeal(nId);
  const editBody = (meal: ValidatedMeal, recipe: Partial<ReturnType<typeof clientEdit>>, extra: Record<string, unknown> = {}) =>
    ({ ...monday, kind: 'edit', expectedMeal: expected(meal), recipe: { ...clientEdit(meal), ...recipe }, ...extra });
  assert.equal(parseDraftMealChange(editBody(nOriginal, {}))!.change.kind === 'edit' && (parseDraftMealChange(editBody(nOriginal, {}))!.change as any).nutrition, null, 'older clients send no nutrition');
  for (const bad of [{ ...estimate, accuracy: 'exact' }, { ...estimate, perServing: false }, { ...estimate, calories: -1 }, { ...estimate, basisLabel: '' },
    { ...estimate, calories: null, protein: null, carbs: null, fat: null, fiber: null, sodium: null }, { calories: 410 }]) {
    assert.equal(parseDraftMealChange(editBody(nOriginal, { title: 'Bad nutrition' }, { nutrition: bad })), null, JSON.stringify(bad));
  }
  assert.equal(parseDraftMealChange({ ...monday, kind: 'replace', expectedMeal: expected(nOriginal), nutrition: estimate }), null, 'replace never accepts an estimate');
  const withNutrition = await changeMealPlanDraftMeal(nId, 'owner', parseDraftMealChange(editBody(nOriginal, { title: 'Carrot rice with herbs' }, { nutrition: estimate }))!, {}, n.deps);
  assert.deepEqual(withNutrition.days![0].meals.dinner!.nutrition, estimate);
  assert.deepEqual((n.slotMeal(nId) as any).nutrition, estimate);
  // The stored estimate echoed back (or a stale one) never decides a conflict.
  const shown = n.slotMeal(nId);
  assert.ok(parseDraftMealChange({ ...monday, kind: 'replace', expectedMeal: { ...expected(shown), nutrition: estimate } }), 'expectedMeal accepts the stored echo');
  assert.equal(parseDraftMealChange({ ...monday, kind: 'replace', expectedMeal: { ...expected(shown), nutrition: { ...estimate, accuracy: 'exact' } } }), null);
  const echoed = parseDraftMealChange(editBody(shown, { title: 'Carrot rice pilaf' }, { expectedMeal: { ...expected(shown), nutrition: { ...estimate, calories: 1 } } }))!;
  await changeMealPlanDraftMeal(nId, 'owner', echoed, {}, n.deps);
  assert.equal(n.slotMeal(nId).title, 'Carrot rice pilaf');
  assert.equal((n.slotMeal(nId) as any).nutrition, null, 'an edit without a new estimate clears the old one');
  console.log('PASS edit nutrition: strict per-serving estimate stored with the edited meal; exact claims 400; echo ignored; edits without one clear it');

  // Unchanged content plus a new estimate stores only the estimate and keeps the saved-recipe link.
  const linkedSave = await saveMealPlanDraft(nId, 'owner', monday, n.deps);
  const plain = n.slotMeal(nId);
  const nutritionOnly = await changeMealPlanDraftMeal(nId, 'owner', parseDraftMealChange(editBody(plain, {}, { nutrition: estimate }))!, {}, n.deps);
  assert.equal(nutritionOnly.savedMeals['monday:dinner'], linkedSave.recipeId);
  assert.deepEqual({ ...n.slotMeal(nId), nutrition: undefined }, { ...plain, nutrition: undefined }, 'meal text unchanged');
  assert.deepEqual((n.slotMeal(nId) as any).nutrition, estimate);
  // An estimate for a different serving count is not this meal's estimate.
  await changeMealPlanDraftMeal(nId, 'owner', parseDraftMealChange(editBody(n.slotMeal(nId), { title: 'Four-serving label' },
    { nutrition: { ...estimate, basisLabel: 'Per recipe serving (recipe makes 4)' } }))!, {}, n.deps);
  assert.equal((n.slotMeal(nId) as any).nutrition, null);
  await changeMealPlanDraftMeal(nId, 'owner', parseDraftMealChange(editBody(n.slotMeal(nId), { title: 'Carrot rice supper' }, { nutrition: estimate }))!, {}, n.deps);
  const replacedN = await changeMealPlanDraftMeal(nId, 'owner', { slot: monday, expectedMeal: expected(n.slotMeal(nId)), change: { kind: 'replace' } },
    { replace: replacer({ ...dinner('Bean chili'), nutrition: estimate } as ValidatedMeal) }, n.deps);
  assert.equal(replacedN.days![0].meals.dinner!.nutrition, null, 'replacement never inherits or smuggles an estimate');
  console.log('PASS nutrition-only edit keeps the saved link; mismatched-serving estimates and replacements clear nutrition');

  // Explicit saves copy the estimate into Recipe.comparisonSnapshot.freshNutrition.
  await changeMealPlanDraftMeal(nId, 'owner', parseDraftMealChange(editBody(n.slotMeal(nId), { title: 'Bean chili bowl' }, { nutrition: estimate }))!, {}, n.deps);
  const savedN = await saveMealPlanDraft(nId, 'owner', monday, n.deps);
  const savedRecipe = n.recipes().get(savedN.recipeId!)!;
  assert.deepEqual(savedRecipe.comparisonSnapshot, { version: 1, source: 'dish', originalNutrition: null, freshNutrition: estimate });
  assert.equal(savedRecipe.calories, 410); assert.equal(savedRecipe.sodium, null);
  const wholeN = await saveMealPlanDraft(nId, 'owner', undefined, n.deps);
  const tuesdayRecipe = n.recipes().get(n.plans().get(wholeN.planId!).mealPlanRecipes.create.find((entry: any) => entry.day === 'tuesday').recipeId);
  assert.equal(tuesdayRecipe.comparisonSnapshot, undefined, 'meals without an estimate save without a snapshot, as before');
  assert.equal(tuesdayRecipe.calories, 300);
  console.log('PASS explicit save preserves the edited estimate in comparisonSnapshot; meals without one save as before');

  // Generated ingredient amounts: required for replacements, never for stored drafts or manual edits.
  const q = fixture(); const qId = await q.create();
  const unmeasured = { ingredients: ['4 oz tofu', 'Cooked rice for serving', 'Salt to taste'] };
  await assert.rejects(changeMealPlanDraftMeal(qId, 'owner', { slot: monday, expectedMeal: expected(q.slotMeal(qId)), change: { kind: 'replace' } },
    { replace: replacer(dinner('Tofu rice plate', unmeasured)) }, q.deps), status(422));
  q.drafts().get(qId)!.meals![1].meals.dinner!.ingredients = unmeasured.ingredients;
  const tuesdaySlot = { day: 'tuesday' as const, mealType: 'dinner' as const };
  const oldDraftMeal = q.slotMeal(qId, 'tuesday');
  await changeMealPlanDraftMeal(qId, 'owner', parseDraftMealChange({ ...tuesdaySlot, kind: 'edit', expectedMeal: expected(oldDraftMeal),
    recipe: { ...clientEdit(oldDraftMeal), title: 'Tofu rice, edited' } })!, {}, q.deps);
  assert.deepEqual(q.slotMeal(qId, 'tuesday').ingredients, unmeasured.ingredients, 'manual edits keep unmeasured lines');
  const oldSaved = await saveMealPlanDraft(qId, 'owner', tuesdaySlot, q.deps);
  assert.equal(q.recipes().get(oldSaved.recipeId!)!.freshIngredients, unmeasured.ingredients.join('\n'));
  console.log('PASS unmeasured generated replacement is rejected; old drafts with unmeasured lines still edit and save');

  // Route gates that run before any database or AI access.
  process.env.NEXTAUTH_SECRET = 'offline-test-only';
  const { POST } = await import('../app/api/meal-plans/drafts/[id]/meals/route');
  const call = (body: unknown, auth?: string) => POST(new Request('http://test/api', { method: 'POST', body: JSON.stringify(body),
    headers: auth ? { authorization: auth } : {} }), { params: Promise.resolve({ id }) });
  const valid = { day: 'monday', mealType: 'dinner', expectedMeal: { ...expected(latest), dietaryTags: [], estimatedCalories: 300 }, kind: 'replace' };
  assert.equal((await call(valid, 'Bearer forged')).status, 401);
  const token = `Bearer ${jwt.sign({ type: 'access' }, 'offline-test-only', { subject: 'owner', issuer: 'recipe-reborn', audience: 'recipe-reborn-mobile', algorithm: 'HS256', expiresIn: 60 })}`;
  const recipe = { title: 'X', freshIngredients: ['1 cup rice'], instructions: ['Cook.'], prepTime: '', cookTime: '', servings: '2' };
  for (const bad of [
    { ...valid, extra: true },
    { ...valid, kind: 'edit' },
    { ...valid, kind: 'replace', recipe },
    { ...valid, kind: 'edit', recipe: { ...recipe, calories: 1 } },
    { ...valid, kind: 'edit', recipe: { ...recipe, instructions: 'Cook.' } },
    { ...valid, kind: 'edit', recipe, nutrition: { ...estimate, accuracy: 'exact' } },
    { ...valid, kind: 'replace', nutrition: estimate },
    { ...valid, expectedMeal: { ...valid.expectedMeal, savedAt: 'x' } },
    { ...valid, day: 'someday' },
  ]) assert.equal((await call(bad, token)).status, 400, JSON.stringify(bad));
  const route = fs.readFileSync('app/api/meal-plans/drafts/[id]/meals/route.ts', 'utf8');
  assert.doesNotMatch(route, /(?:recipe|mealPlan|mealPlanRecipe)\.(?:create|update|delete)/);
  assert.match(route, /limitAiRequest/); assert.match(route, /hasPremiumAccess/); assert.match(route, /withRequestDeadline/);
  assert.doesNotMatch(route, /trial|resolvePartnerTrial|subscriptionStatus/i, 'Same premium entitlement as saved plans; no preview-only trial cap');
  // Saved-plan and preview replacement share one generator.
  const savedRoute = fs.readFileSync('app/api/meal-plans/[id]/recipes/[recipeId]/replace/route.ts', 'utf8');
  for (const source of [route, savedRoute]) {
    assert.match(source, /generateMealReplacement/); assert.doesNotMatch(source, /recipeChat|MODEL_FAST|MODEL_SMART/);
  }
  console.log('PASS route: forged auth 401, strict payloads 400, premium/rate/deadline gates present, shared generator, no Recipe/MealPlan writes');
  console.log('Meal draft change tests passed (transactional fake; live database and phone acceptance still required).');
}
main().then(() => process.exit(process.exitCode ?? 0)).catch(error => { console.error(error); process.exit(1); });
