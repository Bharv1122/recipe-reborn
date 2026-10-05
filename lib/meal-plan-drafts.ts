import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './db';
import {
  validateMeal, DAYS, MEAL_TYPES, MEAL_INSTRUCTIONS_MAX_CHARS,
  type ValidatedDayPlan, type ValidatedMeal, type DayName, type MealType,
} from './meal-plan-validation';
import type { GeneratePlanOptions } from './meal-plan-generation';
import { effectiveDislikes } from './meal-plan-settings';
import { mealTitleKey, type ReplacementRequest } from './meal-plan-replacement';
import { freshNutritionSchema, recipeComparisonSchema } from './recipe-comparison-validation';
import { NUTRIENT_FIELDS, type FreshNutritionEstimate } from '../shared/nutrition-facts';

// Kept outside Recipe/MealPlan: generating a preview never saves either.
// Raw, parameterized queries allow the additive table to roll out independently
// of existing clients. All reads and writes are scoped to the authenticated owner.
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 6 * 60 * 1000;
type Tx = Prisma.TransactionClient;
type Dependencies = { db?: typeof prisma; now?: () => Date };
export type DraftRow = {
  id: string; userId: string; status: string; settings: GeneratePlanOptions;
  meals: Array<{ day: DayName; meals: Record<MealType, DraftMeal | undefined> }> | null; recipeIds: Record<string, string>;
  savedPlanId: string | null; createdAt: Date; expiresAt: Date;
};
export class MealPlanDraftError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string>) { super(message); }
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

// ---- Nutrition stored with a preview meal ----
// RecipeDetail's per-serving estimate is kept beside the exact meal it was
// calculated for. Any content change without a new estimate clears it.
export type DraftMeal = ValidatedMeal & { nutrition?: FreshNutritionEstimate | null };
// Same rule as RecipeDetail: at least one nutrient is a number (labels alone are not an estimate).
const draftNutritionSchema = freshNutritionSchema.refine(value => NUTRIENT_FIELDS.some(({ key }) => value[key] !== null),
  'Nutrition estimate must contain at least one value');

/** The stored estimate when it is valid for this meal's serving count; otherwise null. */
function nutritionFor(meal: Pick<ValidatedMeal, 'servings'>, value: unknown): FreshNutritionEstimate | null {
  const parsed = draftNutritionSchema.safeParse(value);
  if (!parsed.success) return null;
  // The estimate route labels its basis "recipe makes N"; a different N is per a different serving.
  const basis = parsed.data.basisLabel.match(/recipe makes (\d+)/i);
  return basis && Number(basis[1]) !== meal.servings ? null : parsed.data;
}

function nutritionColumns(nutrition: FreshNutritionEstimate) {
  return {
    calories: nutrition.calories == null ? null : Math.round(nutrition.calories),
    protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat, fiber: nutrition.fiber,
    sodium: nutrition.sodium == null ? null : Math.round(nutrition.sodium),
    comparisonSnapshot: recipeComparisonSchema.parse({ version: 1, source: 'dish', originalNutrition: null, freshNutrition: nutrition }),
  };
}

function recipeData(userId: string, meal: DraftMeal, saved: boolean) {
  return { userId, title: meal.title, originalIngredients: meal.ingredients.join('\n'), freshIngredients: meal.ingredients.join('\n'),
    instructions: meal.instructions, prepTime: meal.prepTime, cookTime: meal.cookTime, servings: String(meal.servings),
    dietaryTags: meal.dietaryTags, calories: meal.estimatedCalories, savedAt: saved ? new Date() : null, librarySource: 'meal_plan',
    ...(meal.nutrition && nutritionColumns(meal.nutrition)) };
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
      dislikedIngredients: effectiveDislikes(draft.settings.dislikedIngredients, profile.dislikedIngredients, draft.settings.accountDislikesAtCreation) });
    if (!result.success) throw new MealPlanDraftError(422, 'Your food preferences changed or this meal could not be validated. Generate a new preview before saving.');
    // validateMeal rebuilds the meal; keep the estimate stored with it.
    entry.meal = { ...result.meal, nutrition: nutritionFor(result.meal, entry.meal.nutrition) };
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
        // An estimate added after this copy was written is attached only if the copy has none.
        if (only) await tx.recipe.update({ where: { id: existing.id }, data: { savedAt: new Date(),
          ...(entry.meal.nutrition && existing.comparisonSnapshot == null && nutritionColumns(entry.meal.nutrition)) } });
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
      // Keep exclusions on the saved plan independently of the seven-day preview.
      await tx.$executeRaw`UPDATE "MealPlan" SET "generationSettings" = ${JSON.stringify({
        allergies: draft.settings.allergies,
        dislikedIngredients: draft.settings.dislikedIngredients,
        dietaryPreferences: draft.settings.dietaryPreferences,
        // Creation baseline, not save time: dislikes added in between stay enforced on replacement.
        accountDislikesAtCreation: draft.settings.accountDislikesAtCreation,
      })}::jsonb WHERE id = ${plan.id} AND "userId" = ${userId}`;
    }
    await tx.$executeRaw`UPDATE "MealPlanDraft" SET "recipeIds" = ${JSON.stringify(recipeIds)}::jsonb, "savedPlanId" = ${planId} WHERE id = ${id} AND "userId" = ${userId}`;
    return only ? { recipeId: savedRecipeId } : { planId };
  }, { timeout: 15000 });
}

// ---- Changing one unsaved preview meal ----
// Only the preview row changes. Recipe and MealPlan rows are untouched: a copy
// already saved to My recipes stays there, and the slot is unlinked so the next
// explicit save writes the new content. Plan servings never change here.
export type DraftSlot = { day: DayName; mealType: MealType };
// Clients echo the full meal they last saw. Tags are optional so older clients
// (and meals stored before tags existed, read as []) still compare cleanly.
// A nutrition echo is accepted but ignored: estimates never decide a conflict.
export type ExpectedMeal = Pick<ValidatedMeal, 'title' | 'ingredients' | 'instructions' | 'prepTime' | 'cookTime' | 'servings'> & { dietaryTags?: string[] };
// nutrition is the estimate RecipeDetail calculated for exactly this edited meal.
export type DraftMealChange = { kind: 'replace' } | { kind: 'edit'; meal: unknown; nutrition?: FreshNutritionEstimate | null };
export type MealReplacer = (request: ReplacementRequest) => Promise<ValidatedMeal | null>;

// Request body for POST /api/meal-plans/drafts/[id]/meals (see MealPlanPreviewChange).
const expectedMealSchema = z.object({
  title: z.string().max(160),
  ingredients: z.array(z.string().max(500)).max(40),
  instructions: z.string().max(MEAL_INSTRUCTIONS_MAX_CHARS),
  prepTime: z.string().max(50),
  cookTime: z.string().max(50),
  servings: z.number().int(),
  dietaryTags: z.array(z.string().max(50)).max(12).optional(),
  estimatedCalories: z.number().nullable().optional(),
  nutrition: freshNutritionSchema.nullable().optional(),
}).strict();
// The RecipeDetail edit snapshot sends one line per step, so a stored single
// long paragraph arrives as one long step. Only the joined total is bounded,
// the same total a stored meal can hold.
const editedRecipeSchema = z.object({
  title: z.string().trim().min(1).max(160),
  freshIngredients: z.array(z.string().trim().min(1).max(500)).min(1).max(40),
  instructions: z.array(z.string().trim().min(1).max(MEAL_INSTRUCTIONS_MAX_CHARS)).min(1)
    .max(Math.ceil(MEAL_INSTRUCTIONS_MAX_CHARS / 2))
    .refine(steps => steps.join('\n').length <= MEAL_INSTRUCTIONS_MAX_CHARS),
  prepTime: z.string().trim().max(50),
  cookTime: z.string().trim().max(50),
  servings: z.string().trim().min(1).max(20),
  dietaryTags: z.array(z.string().trim().min(1).max(50)).max(12).optional(),
}).strict();
const slotSchema = { day: z.enum(DAYS), mealType: z.enum(MEAL_TYPES), expectedMeal: expectedMealSchema };
const changeSchema = z.discriminatedUnion('kind', [
  z.object({ ...slotSchema, kind: z.literal('replace') }).strict(),
  // Optional for older clients. Must be a per-serving estimate; exact claims are a 400.
  z.object({ ...slotSchema, kind: z.literal('edit'), recipe: editedRecipeSchema, nutrition: draftNutritionSchema.nullable().optional() }).strict(),
]);

/** Strictly parses a change request; null means 400. Validation of the meal itself happens in changeMealPlanDraftMeal. */
export function parseDraftMealChange(body: unknown): { slot: DraftSlot; expectedMeal: ExpectedMeal; change: DraftMealChange } | null {
  const parsed = changeSchema.safeParse(body);
  if (!parsed.success) return null;
  const { day, mealType, expectedMeal: { nutrition: _echo, ...expectedMeal } } = parsed.data;
  if (parsed.data.kind === 'replace') return { slot: { day, mealType }, expectedMeal, change: { kind: 'replace' } };
  const recipe = parsed.data.recipe;
  return { slot: { day, mealType }, expectedMeal, change: { kind: 'edit', meal: {
    title: recipe.title,
    ingredients: recipe.freshIngredients,
    instructions: recipe.instructions.join('\n'),
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    // "2" or "2 servings"; anything else fails validation with a clear message.
    servings: Number(recipe.servings.match(/^(\d{1,2})\b/)?.[1] ?? NaN),
    dietaryTags: recipe.dietaryTags ?? [],
    // Edited ingredients invalidate the old estimate.
    estimatedCalories: null,
  }, nutrition: parsed.data.nutrition ?? null } };
}

const sameList = (a: string[] | undefined, b: string[] | undefined) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
// The edit screen shows instructions one step per line and drops blank lines.
const instructionLines = (text: string) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n');

function sameMeal(meal: ValidatedMeal | undefined, expected: ExpectedMeal) {
  return Boolean(meal) && meal!.title === expected.title && meal!.instructions === expected.instructions
    && meal!.prepTime === expected.prepTime && meal!.cookTime === expected.cookTime && meal!.servings === expected.servings
    && JSON.stringify(meal!.ingredients) === JSON.stringify(expected.ingredients)
    && (expected.dietaryTags === undefined || sameList(meal!.dietaryTags, expected.dietaryTags));
}

// An edit that only round-trips the meal through the editor is a no-op.
function unchangedEdit(meal: ValidatedMeal, edited: ValidatedMeal) {
  return meal.title === edited.title && instructionLines(meal.instructions) === instructionLines(edited.instructions)
    && meal.prepTime === edited.prepTime && meal.cookTime === edited.cookTime && meal.servings === edited.servings
    && JSON.stringify(meal.ingredients) === JSON.stringify(edited.ingredients) && sameList(meal.dietaryTags, edited.dietaryTags);
}

// Rechecked under the row lock: a stale tab, a second phone, or a save that won
// the race must not be overwritten.
function mutableSlot(row: DraftRow | undefined, now: Date, slot: DraftSlot, expected: ExpectedMeal) {
  const draft = requireReady(row, now);
  if (draft.savedPlanId) throw new MealPlanDraftError(409, 'This plan is already saved. Open the saved plan to change its meals.', { savedPlanId: draft.savedPlanId });
  const meal = draft.settings.mealTypes.includes(slot.mealType) ? draft.meals!.find(day => day.day === slot.day)?.meals[slot.mealType] : undefined;
  if (!meal) throw new MealPlanDraftError(404, 'Meal not found in this preview.');
  if (!sameMeal(meal, expected)) throw new MealPlanDraftError(409, 'This meal was changed somewhere else. Reload the preview to see the latest version.');
  return { draft, meal };
}

function slotPreferences(draft: DraftRow, profile: { allergies: string[]; dislikedIngredients: string[] }) {
  return {
    allergies: [...new Set([...draft.settings.allergies, ...profile.allergies])],
    dislikedIngredients: effectiveDislikes(draft.settings.dislikedIngredients, profile.dislikedIngredients, draft.settings.accountDislikesAtCreation),
  };
}

function otherTitles(draft: DraftRow, slot: DraftSlot) {
  return draft.meals!.flatMap(day => draft.settings.mealTypes
    .filter(mealType => !(day.day === slot.day && mealType === slot.mealType))
    .map(mealType => day.meals[mealType]?.title).filter((title): title is string => Boolean(title)));
}

// Checked here, not only in the generator: whatever produced the meal, a
// replacement must differ from the current meal and every other plan meal.
function repeatsPlanTitle(draft: DraftRow, slot: DraftSlot, current: ValidatedMeal, candidate: ValidatedMeal) {
  const key = mealTitleKey(candidate.title);
  return [current.title, ...otherTitles(draft, slot)].some(title => mealTitleKey(title) === key);
}

function editRejection(code: string, servings: number) {
  switch (code) {
    case 'serving_mismatch': return `This plan uses ${servings} servings per meal. Keep ${servings} servings to change it here.`;
    case 'allergen_detected': return 'This edit includes one of your allergies. Your current meal was kept.';
    case 'disliked_ingredient': return 'This edit includes an ingredient you avoid. Your current meal was kept.';
    case 'prepared_shortcut': return 'Plan meals are made from basic ingredients. Replace the prepared shortcut and try again.';
    default: return 'Check the title, ingredients, and instructions, then try again.';
  }
}

export async function changeMealPlanDraftMeal(
  id: string, userId: string,
  input: { slot: DraftSlot; expectedMeal: ExpectedMeal; change: DraftMealChange },
  options: { replace?: MealReplacer } = {},
  deps: Dependencies = {},
) {
  const db = deps.db ?? prisma;
  const clock = deps.now ?? (() => new Date());
  const { slot, expectedMeal, change } = input;
  // Fail fast (before any AI spend) on owner, expiry, saved plan and stale input.
  const [initial] = await db.$queryRaw<DraftRow[]>`SELECT * FROM "MealPlanDraft" WHERE id = ${id} AND "userId" = ${userId}`;
  const { draft, meal: current } = mutableSlot(initial, clock(), slot, expectedMeal);
  const profile = await db.user.findUnique({ where: { id: userId }, select: { allergies: true, dislikedIngredients: true } });
  if (!profile) throw new MealPlanDraftError(401, 'Please sign in again.');

  let candidate: ValidatedMeal;
  // Replacements never inherit an estimate; edits keep only the one sent for them.
  let nutrition: FreshNutritionEstimate | null = null;
  let nutritionOnly = false;
  if (change.kind === 'edit') {
    const checked = validateMeal(change.meal, { servings: draft.settings.servings, ...slotPreferences(draft, profile), ...slot });
    if (!checked.success) throw new MealPlanDraftError(422, editRejection(checked.error.code, draft.settings.servings));
    candidate = checked.meal;
    nutrition = nutritionFor(candidate, change.nutrition);
    if (unchangedEdit(current, candidate)) {
      // Nothing changed: keep the stored text, any saved-recipe link, and the
      // stored estimate unless a new one for this same meal was sent.
      const stored = nutritionFor(current, current.nutrition);
      if (!nutrition || JSON.stringify(nutrition) === JSON.stringify(stored)) return getMealPlanDraft(id, userId, deps);
      nutritionOnly = true;
    }
  } else {
    if (!options.replace) throw new MealPlanDraftError(503, 'Meal replacement is temporarily unavailable. Your current meal was kept.');
    const generated = await options.replace({ ...slot, servings: draft.settings.servings, ...slotPreferences(draft, profile),
      dietaryPreferences: draft.settings.dietaryPreferences, preferredIngredients: draft.settings.preferredIngredients ?? [],
      excludedTitles: [current.title, ...otherTitles(draft, slot)] });
    const checked = generated && validateMeal(generated, { servings: draft.settings.servings, ...slotPreferences(draft, profile), usMeasures: true, ...slot });
    if (!checked || !checked.success) throw new MealPlanDraftError(422, 'No safe replacement was produced. Your current meal was kept.');
    candidate = checked.meal;
    if (repeatsPlanTitle(draft, slot, current, candidate)) throw new MealPlanDraftError(422, 'The replacement repeated a meal already in this plan. Your current meal was kept; please try again.');
  }

  await db.$transaction(async tx => {
    const [row] = await tx.$queryRaw<DraftRow[]>`SELECT * FROM "MealPlanDraft" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
    const { draft: locked, meal: lockedCurrent } = mutableSlot(row, clock(), slot, expectedMeal);
    const recipeIds = { ...locked.recipeIds };
    let stored: DraftMeal;
    if (nutritionOnly) {
      // Content still matches (mutableSlot above), so keep it and the saved-recipe link.
      stored = { ...lockedCurrent, nutrition };
    } else {
      // Preferences can change while the model runs; recheck before writing.
      const [latest] = await tx.$queryRaw<Array<{ allergies: string[]; dislikedIngredients: string[] }>>`
        SELECT allergies, "dislikedIngredients" FROM "User" WHERE id = ${userId} FOR SHARE`;
      if (!latest) throw new MealPlanDraftError(401, 'Please sign in again.');
      if (!validateMeal(candidate, { servings: locked.settings.servings, ...slotPreferences(locked, latest), ...slot }).success) {
        throw new MealPlanDraftError(409, 'Your food preferences changed. Your current meal was kept; please try again.');
      }
      if (change.kind === 'replace' && repeatsPlanTitle(locked, slot, lockedCurrent, candidate)) {
        throw new MealPlanDraftError(409, 'That replacement repeats another meal in this plan. Your current meal was kept; please try again.');
      }
      stored = { ...candidate, nutrition };
      delete recipeIds[`${slot.day}:${slot.mealType}`];
    }
    const meals = locked.meals!.map(day => day.day === slot.day ? { ...day, meals: { ...day.meals, [slot.mealType]: stored } } : day);
    await tx.$executeRaw`UPDATE "MealPlanDraft" SET meals = ${JSON.stringify(meals)}::jsonb, "recipeIds" = ${JSON.stringify(recipeIds)}::jsonb
      WHERE id = ${id} AND "userId" = ${userId} AND "savedPlanId" IS NULL`;
  }, { timeout: 15000 });
  return getMealPlanDraft(id, userId, deps);
}
