import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { validateMeal, MEAL_TYPES, type ValidatedDayPlan, type ValidatedMeal, type DayName, type MealType } from './meal-plan-validation';
import type { GeneratePlanOptions } from './meal-plan-generation';

// Kept outside Recipe/MealPlan: generating a preview never saves either.
// Raw, parameterized queries allow the additive table to roll out independently
// of existing clients. All reads and writes are scoped to the authenticated owner.
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 6 * 60 * 1000;
type Tx = Prisma.TransactionClient;
type Dependencies = { db?: typeof prisma; now?: () => Date };
export type DraftRow = {
  id: string; userId: string; status: string; settings: GeneratePlanOptions;
  meals: ValidatedDayPlan[] | null; recipeIds: Record<string, string>;
  savedPlanId: string | null; createdAt: Date; expiresAt: Date;
};
export class MealPlanDraftError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function reserveMealPlanDraft(userId: string, settings: GeneratePlanOptions, trialLimit: number | null, deps: Dependencies = {}) {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  return db.$transaction(async tx => {
    // Lock a real owner row, so simultaneous requests cannot overspend a trial.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (trialLimit !== null) {
      const [usage] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) AS count FROM "MealPlanDraft" WHERE "userId" = ${userId}
          AND (status = 'ready' OR (status = 'pending' AND "createdAt" > ${new Date(now.getTime() - PENDING_TTL_MS)}))`;
      if (Number(usage.count) >= trialLimit) throw new MealPlanDraftError(403, `Your trial includes ${trialLimit} meal-plan generations. Saving a meal uses no extra generation.`);
    }
    // Retain usage receipts; erase expired recipe payloads, never reset quota.
    await tx.$executeRaw`UPDATE "MealPlanDraft" SET meals = NULL, settings = '{}'::jsonb, "recipeIds" = '{}'::jsonb WHERE "userId" = ${userId} AND "expiresAt" <= ${now}`;
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "MealPlanDraft" (id, "userId", settings, status, "createdAt", "expiresAt")
      VALUES (${id}, ${userId}, ${JSON.stringify(settings)}::jsonb, 'pending', ${now}, ${new Date(now.getTime() + DRAFT_TTL_MS)})`;
    return id;
  });
}

export async function completeMealPlanDraft(id: string, userId: string, meals: ValidatedDayPlan[], deps: Dependencies = {}) {
  const now = (deps.now ?? (() => new Date()))();
  const changed = await (deps.db ?? prisma).$executeRaw`UPDATE "MealPlanDraft" SET meals = ${JSON.stringify(meals)}::jsonb, status = 'ready'
    WHERE id = ${id} AND "userId" = ${userId} AND status = 'pending' AND "createdAt" > ${new Date(now.getTime() - PENDING_TTL_MS)}`;
  if (!changed) throw new MealPlanDraftError(503, 'The preview took too long. Please generate it again. Nothing was saved.');
}

export async function failMealPlanDraft(id: string, userId: string, deps: Dependencies = {}) {
  await (deps.db ?? prisma).$executeRaw`UPDATE "MealPlanDraft" SET status = 'failed', meals = NULL, settings = '{}'::jsonb WHERE id = ${id} AND "userId" = ${userId} AND status = 'pending'`;
}

// Called by the existing authenticated daily maintenance job. Keep receipts,
// remove recipe/profile payloads even when the owner never generates again.
export async function purgeExpiredMealPlanDrafts(deps: Dependencies = {}) {
  const now = (deps.now ?? (() => new Date()))();
  return (deps.db ?? prisma).$executeRaw`UPDATE "MealPlanDraft" SET meals = NULL, settings = '{}'::jsonb, "recipeIds" = '{}'::jsonb
    WHERE "expiresAt" <= ${now} AND (meals IS NOT NULL OR settings <> '{}'::jsonb OR "recipeIds" <> '{}'::jsonb)`;
}

function requireReady(row: DraftRow | undefined, now: Date): DraftRow {
  if (!row) throw new MealPlanDraftError(404, 'Preview not found.');
  if (row.expiresAt <= now) throw new MealPlanDraftError(410, 'This preview has expired. Meals you saved are still in My recipes.');
  if (row.status !== 'ready' || !Array.isArray(row.meals)) throw new MealPlanDraftError(409, 'This preview is not ready. Please try again.');
  return row;
}

export async function getMealPlanDraft(id: string, userId: string, deps: Dependencies = {}) {
  const db = deps.db ?? prisma;
  const [row] = await db.$queryRaw<DraftRow[]>`SELECT * FROM "MealPlanDraft" WHERE id = ${id} AND "userId" = ${userId}`;
  const draft = requireReady(row, (deps.now ?? (() => new Date()))());
  const recipes = await db.recipe.findMany({ where: { userId, id: { in: Object.values(draft.recipeIds) }, savedAt: { not: null } }, select: { id: true } });
  const saved = new Set(recipes.map(recipe => recipe.id));
  return { id: draft.id, expiresAt: draft.expiresAt, weekStartDate: draft.settings.weekStartDate,
    servings: draft.settings.servings, days: draft.meals,
    savedMeals: Object.fromEntries(Object.entries(draft.recipeIds).filter(([, recipeId]) => saved.has(recipeId))),
    savedPlanId: draft.savedPlanId };
}

export async function listMealPlanDrafts(userId: string, deps: Dependencies = {}) {
  const now = (deps.now ?? (() => new Date()))();
  return (deps.db ?? prisma).$queryRaw<Array<{ id: string; expiresAt: Date; weekStartDate: string }>>`
    SELECT id, "expiresAt", settings->>'weekStartDate' AS "weekStartDate" FROM "MealPlanDraft"
    WHERE "userId" = ${userId} AND status = 'ready' AND "expiresAt" > ${now} AND "savedPlanId" IS NULL
    ORDER BY "createdAt" DESC LIMIT 10`;
}

function recipeData(userId: string, meal: ValidatedMeal, saved: boolean) {
  return { userId, title: meal.title, originalIngredients: meal.ingredients.join('\n'), freshIngredients: meal.ingredients.join('\n'),
    instructions: meal.instructions, prepTime: meal.prepTime, cookTime: meal.cookTime, servings: String(meal.servings),
    dietaryTags: meal.dietaryTags, calories: meal.estimatedCalories, savedAt: saved ? new Date() : null, librarySource: 'meal_plan' };
}

async function checkedMeals(tx: Tx, draft: DraftRow, userId: string, only?: { day: DayName; mealType: MealType }) {
  const profile = await tx.user.findUnique({ where: { id: userId }, select: { allergies: true, dislikedIngredients: true } });
  if (!profile) throw new MealPlanDraftError(401, 'Please sign in again.');
  const entries = draft.meals!.flatMap(day => draft.settings.mealTypes.map(mealType => ({ day: day.day, mealType, meal: day.meals[mealType]! })))
    .filter(entry => !only || (entry.day === only.day && entry.mealType === only.mealType));
  if (!entries.length) throw new MealPlanDraftError(404, 'Meal not found in this preview.');
  for (const entry of entries) {
    const result = validateMeal(entry.meal, { servings: draft.settings.servings,
      allergies: [...draft.settings.allergies, ...profile.allergies],
      dislikedIngredients: [...draft.settings.dislikedIngredients, ...profile.dislikedIngredients] });
    if (!result.success) throw new MealPlanDraftError(422, 'Your food preferences changed or this meal could not be validated. Generate a new preview before saving.');
    entry.meal = result.meal;
  }
  return entries;
}

export async function saveMealPlanDraft(id: string, userId: string, only?: { day: DayName; mealType: MealType }, deps: Dependencies = {}) {
  const db = deps.db ?? prisma;
  return db.$transaction(async tx => {
    const [row] = await tx.$queryRaw<DraftRow[]>`SELECT * FROM "MealPlanDraft" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
    const draft = requireReady(row, (deps.now ?? (() => new Date()))());
    if (!only && draft.savedPlanId) {
      const plan = await tx.mealPlan.findFirst({ where: { id: draft.savedPlanId, userId } });
      if (plan) return { planId: plan.id };
      throw new MealPlanDraftError(409, 'This plan was already saved and then deleted. Generate a new preview to create another.');
    }
    if (only) {
      const priorId = draft.recipeIds[`${only.day}:${only.mealType}`];
      const alreadySaved = priorId ? await tx.recipe.findFirst({ where: { id: priorId, userId, savedAt: { not: null } } }) : null;
      if (alreadySaved?.savedAt) return { recipeId: alreadySaved.id };
    }
    // New writes must pass current preferences. Completed retries return above.
    const entries = await checkedMeals(tx, draft, userId, only);
    const recipeIds = { ...draft.recipeIds };
    let savedRecipeId: string | undefined;
    for (const entry of entries) {
      const key = `${entry.day}:${entry.mealType}`;
      const existing = recipeIds[key] ? await tx.recipe.findFirst({ where: { id: recipeIds[key], userId } }) : null;
      if (existing) {
        // An edited saved recipe must not silently replace what the preview shows.
        if (existing.title !== entry.meal.title || existing.freshIngredients !== entry.meal.ingredients.join('\n') || existing.instructions !== entry.meal.instructions || Number(existing.servings) !== entry.meal.servings) {
          throw new MealPlanDraftError(409, 'A saved copy was edited. Open that recipe to add it to a plan, or generate a new preview.');
        }
        if (only) await tx.recipe.update({ where: { id: existing.id }, data: { savedAt: new Date() } });
        savedRecipeId = existing.id;
      } else {
        const recipe = await tx.recipe.create({ data: recipeData(userId, entry.meal, Boolean(only)) });
        recipeIds[key] = recipe.id;
        savedRecipeId = recipe.id;
      }
    }
    let planId: string | null = draft.savedPlanId;
    if (!only) {
      const plan = await tx.mealPlan.create({ data: { userId,
        name: `Meal Plan - Week of ${draft.settings.weekStartDate.slice(0, 10)}`,
        weekStartDate: new Date(draft.settings.weekStartDate), description: 'Saved from your meal preview.',
        mealPlanRecipes: { create: entries.map(({ day, mealType }) => ({ day, mealType,
          recipeId: recipeIds[`${day}:${mealType}`], servings: draft.settings.servings, order: MEAL_TYPES.indexOf(mealType) })) } } });
      planId = plan.id;
    }
    await tx.$executeRaw`UPDATE "MealPlanDraft" SET "recipeIds" = ${JSON.stringify(recipeIds)}::jsonb, "savedPlanId" = ${planId} WHERE id = ${id} AND "userId" = ${userId}`;
    return only ? { recipeId: savedRecipeId } : { planId };
  }, { timeout: 15000 });
}
