CREATE TABLE "RecipeReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "recipeTitle" TEXT NOT NULL,
    "recipeSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecipeReport_userId_createdAt_idx"
    ON "RecipeReport"("userId", "createdAt");
CREATE INDEX "RecipeReport_recipeId_idx"
    ON "RecipeReport"("recipeId");

ALTER TABLE "RecipeReport"
    ADD CONSTRAINT "RecipeReport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma is the only access path. Reports can contain user-supplied comments
-- and recipe contents and must not be exposed by Supabase's public Data API.
REVOKE ALL ON TABLE "RecipeReport" FROM anon, authenticated;
ALTER TABLE "RecipeReport" ENABLE ROW LEVEL SECURITY;
