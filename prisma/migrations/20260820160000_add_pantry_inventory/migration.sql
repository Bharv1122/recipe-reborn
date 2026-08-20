CREATE TABLE IF NOT EXISTS "PantryInventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PantryInventory_userId_key" ON "PantryInventory"("userId");
CREATE INDEX IF NOT EXISTS "PantryInventory_updatedAt_idx" ON "PantryInventory"("updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PantryInventory_userId_fkey'
  ) THEN
    ALTER TABLE "PantryInventory"
    ADD CONSTRAINT "PantryInventory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RecipeReborn uses NextAuth rather than Supabase Auth. The application server
-- accesses this table through Prisma; public Data API roles get no access.
ALTER TABLE "PantryInventory" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PantryInventory" FROM anon, authenticated;
