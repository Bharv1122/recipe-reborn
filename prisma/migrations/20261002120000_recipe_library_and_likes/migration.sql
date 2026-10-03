ALTER TABLE "User" ADD COLUMN "likedIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Recipe" ADD COLUMN "savedAt" TIMESTAMP(3);
ALTER TABLE "Recipe" ADD COLUMN "librarySource" TEXT NOT NULL DEFAULT 'legacy';

-- Preserve every legacy recipe in the library. Its origin is ambiguous, so
-- cleanup is user-controlled instead of guessing and hiding/deleting data.
UPDATE "Recipe" SET "savedAt" = "createdAt" WHERE "savedAt" IS NULL;
ALTER TABLE "Recipe" ALTER COLUMN "savedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Recipe_userId_savedAt_idx" ON "Recipe"("userId", "savedAt");
