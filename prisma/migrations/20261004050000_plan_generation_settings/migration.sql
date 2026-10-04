ALTER TABLE "MealPlan" ADD COLUMN "generationSettings" JSONB;

-- Recover settings only where the authenticated owner's original preview still
-- exists. Expired/legacy settings remain unknown; never invent exclusions.
UPDATE "MealPlan" AS plan SET "generationSettings" = jsonb_build_object(
  'allergies', draft.settings->'allergies',
  'dislikedIngredients', draft.settings->'dislikedIngredients',
  'dietaryPreferences', draft.settings->'dietaryPreferences')
FROM "MealPlanDraft" AS draft
WHERE draft."savedPlanId" = plan.id AND draft."userId" = plan."userId"
  AND jsonb_typeof(draft.settings->'allergies') = 'array'
  AND jsonb_typeof(draft.settings->'dislikedIngredients') = 'array'
  AND jsonb_typeof(draft.settings->'dietaryPreferences') = 'array';
