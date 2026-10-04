import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prisma } from '../lib/db';
import { reserveMealPlanDraft, completeMealPlanDraft, saveMealPlanDraft, getMealPlanDraft, changeMealPlanDraftMeal } from '../lib/meal-plan-drafts';
import { DAYS, type ValidatedDayPlan } from '../lib/meal-plan-validation';
import type { GeneratePlanOptions } from '../lib/meal-plan-generation';

// Opt-in real SQL verification. Everything, including the temporary schema and
// synthetic account, is rolled back. Never call an AI service or email provider.
async function main() {
  assert.equal(process.env.ALLOW_ROLLBACK_DATABASE_TEST, '1');
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(`${url.hostname} ${url.username}`.includes('sdcvpykbizbsoekuafcf'), 'Wrong database target');
  const schema = `qa_meal_drafts_${randomUUID().replace(/-/g, '')}`;
  const rollback = new Error('EXPECTED_ROLLBACK');
  let complete = false;
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`);
      const migration = readFileSync('prisma/migrations/20261003222339_meal_plan_drafts/migration.sql', 'utf8');
      for (const statement of migration.split(';').filter(value => value.trim())) await tx.$executeRawUnsafe(statement);
      const [policy] = await tx.$queryRaw<Array<{ enabled: boolean }>>`SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = ${`${schema}."MealPlanDraft"`}::regclass`;
      assert.equal(policy.enabled, true);
      const user = await tx.user.create({ data: { name: 'Rollback-only meal preview test' } });
      const settings: GeneratePlanOptions = { weekStartDate: '2026-10-05', mealTypes: ['dinner'], servings: 2, allergies: [], dislikedIngredients: [], dietaryPreferences: [] };
      const meals: ValidatedDayPlan[] = DAYS.map(day => ({ day, meals: { breakfast: undefined, lunch: undefined, snack: undefined,
        dinner: { title: `${day} carrot rice`, ingredients: ['1 cup rice', '2 carrots'], instructions: 'Cook rice in water for 20 minutes. Steam the carrots until tender and serve.', servings: 2, prepTime: '5 min', cookTime: '20 min', dietaryTags: [], estimatedCalories: 300 } } }));
      // Nested service transactions share this outer rollback boundary.
      const deps = { db: { ...tx, $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as typeof prisma };
      const id = await reserveMealPlanDraft(user.id, settings, 2, deps);
      await completeMealPlanDraft(id, user.id, meals, deps);
      assert.equal(await tx.recipe.count({ where: { userId: user.id } }), 0);
      assert.equal(await tx.mealPlan.count({ where: { userId: user.id } }), 0);
      assert.equal((await getMealPlanDraft(id, user.id, deps)).days!.length, 7);
      await assert.rejects(getMealPlanDraft(id, 'other-owner', deps), (error: any) => error.status === 404);
      const slot = { day: 'monday' as const, mealType: 'dinner' as const };
      const original = meals[0].meals.dinner!;
      const edited = { ...original, title: 'Carrot rice with parsley', ingredients: [...original.ingredients, '1 tbsp chopped parsley'] };
      await changeMealPlanDraftMeal(id, user.id, { slot, expectedMeal: original, change: { kind: 'edit', meal: edited, nutrition: null } }, {}, deps);
      assert.equal(await tx.recipe.count({ where: { userId: user.id } }), 0);
      assert.equal(await tx.mealPlan.count({ where: { userId: user.id } }), 0);
      await assert.rejects(changeMealPlanDraftMeal(id, user.id, { slot, expectedMeal: original, change: { kind: 'edit', meal: original, nutrition: null } }, {}, deps), (error: any) => error.status === 409);
      const first = await saveMealPlanDraft(id, user.id, slot, deps);
      assert.equal((await saveMealPlanDraft(id, user.id, slot, deps)).recipeId, first.recipeId);
      assert.equal(await tx.recipe.count({ where: { userId: user.id } }), 1);
      await tx.user.update({ where: { id: user.id }, data: { allergies: ['rice'] } });
      await assert.rejects(saveMealPlanDraft(id, user.id, { day: 'tuesday', mealType: 'dinner' }, deps), (error: any) => error.status === 422);
      assert.equal((await saveMealPlanDraft(id, user.id, slot, deps)).recipeId, first.recipeId);
      await tx.user.update({ where: { id: user.id }, data: { allergies: [] } });
      const replacement = { ...edited, title: 'Carrot rice with basil', ingredients: [...original.ingredients, '1 tbsp chopped basil'] };
      const replaced = await changeMealPlanDraftMeal(id, user.id, { slot, expectedMeal: edited, change: { kind: 'replace' } }, { replace: async () => replacement }, deps);
      assert.equal(replaced.savedMeals['monday:dinner'], undefined);
      assert.equal((await tx.recipe.findUnique({ where: { id: first.recipeId } }))!.title, edited.title);
      assert.equal(await tx.recipe.count({ where: { userId: user.id } }), 1);
      assert.equal(await tx.mealPlan.count({ where: { userId: user.id } }), 0);
      const saved = await saveMealPlanDraft(id, user.id, undefined, deps);
      assert.equal((await saveMealPlanDraft(id, user.id, undefined, deps)).planId, saved.planId);
      assert.equal(await tx.recipe.count({ where: { userId: user.id } }), 8);
      assert.equal(await tx.recipe.count({ where: { userId: user.id, savedAt: { not: null } } }), 1);
      assert.equal(await tx.mealPlan.count({ where: { userId: user.id } }), 1);
      await assert.rejects(changeMealPlanDraftMeal(id, user.id, { slot, expectedMeal: replacement, change: { kind: 'edit', meal: edited, nutrition: null } }, {}, deps), (error: any) => error.status === 409);
      await tx.mealPlan.create({ data: { userId: user.id, name: 'Manual plan', weekStartDate: new Date() } });
      await reserveMealPlanDraft(user.id, settings, 2, deps);
      await assert.rejects(reserveMealPlanDraft(user.id, settings, 2, deps), (error: any) => error.status === 403);
      complete = true;
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.ok(complete);
  const [leftover] = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${schema}) AS exists`;
  assert.equal(leftover.exists, false);
  console.log('PASS real Postgres: migration/RLS/JSONB/dates, no autosave, preview edit/replacement, stale edit refusal, saved-copy preservation, saved-plan refusal, owner checks, current allergy rejection, idempotent saves, manual-plan quota exclusion. All test writes and temporary schema rolled back.');
}
main().catch(error => { console.error(`Postgres check failed: ${error?.name ?? 'Error'} ${error?.code ?? ''}`); if (error instanceof assert.AssertionError) console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
