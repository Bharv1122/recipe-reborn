-- Preserve an anonymous validated recipe briefly so signup can unlock that
-- exact recipe without a second AI request. Tokens are random and stored only
-- as SHA-256 hashes. The owning account can retry idempotently until expiry.
BEGIN;

CREATE TABLE "GuestRecipeHandoff" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "originalIngredients" TEXT,
    "recipe" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestRecipeHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestRecipeHandoff_tokenHash_key"
ON "GuestRecipeHandoff"("tokenHash");

CREATE INDEX "GuestRecipeHandoff_expiresAt_idx"
ON "GuestRecipeHandoff"("expiresAt");

CREATE INDEX "GuestRecipeHandoff_redeemedByUserId_redeemedAt_idx"
ON "GuestRecipeHandoff"("redeemedByUserId", "redeemedAt");

ALTER TABLE "GuestRecipeHandoff"
ADD CONSTRAINT "GuestRecipeHandoff_redeemedByUserId_fkey"
FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Only server-side Prisma may access handoffs. Never expose their recipes or
-- token hashes through the public Data API, regardless of default grants.
ALTER TABLE "GuestRecipeHandoff" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GuestRecipeHandoff" FROM anon, authenticated;

COMMIT;
