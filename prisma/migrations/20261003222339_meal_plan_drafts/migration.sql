-- Preview storage is private to the server. No Recipe or MealPlan is created
-- until an authenticated owner chooses Save. Usage receipts are retained.
CREATE TABLE "MealPlanDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "settings" JSONB NOT NULL,
  "meals" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "recipeIds" JSONB NOT NULL DEFAULT '{}',
  "savedPlanId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealPlanDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MealPlanDraft_status_check" CHECK ("status" IN ('pending', 'ready', 'failed'))
);
CREATE UNIQUE INDEX "MealPlanDraft_savedPlanId_key" ON "MealPlanDraft"("savedPlanId");
CREATE INDEX "MealPlanDraft_userId_createdAt_idx" ON "MealPlanDraft"("userId", "createdAt");
CREATE INDEX "MealPlanDraft_expiresAt_idx" ON "MealPlanDraft"("expiresAt");
-- Preserve only actual AI-plan usage, never count manual/empty schedules.
-- Receipts remain even if a saved plan is later removed.
INSERT INTO "MealPlanDraft" (id, "userId", settings, status, "savedPlanId", "createdAt", "expiresAt")
SELECT 'legacy-plan:' || id, "userId", '{}'::jsonb, 'ready', id, "createdAt", CURRENT_TIMESTAMP
FROM "MealPlan" WHERE description LIKE 'AI-generated meal plan.%';
ALTER TABLE "MealPlanDraft" ENABLE ROW LEVEL SECURITY;
-- No Data API policies: access is through the authenticated server routes only.
