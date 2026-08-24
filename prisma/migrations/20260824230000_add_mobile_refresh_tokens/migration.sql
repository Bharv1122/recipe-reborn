CREATE TABLE "MobileRefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "platform" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileRefreshToken_tokenHash_key"
    ON "MobileRefreshToken"("tokenHash");
CREATE INDEX "MobileRefreshToken_userId_revokedAt_idx"
    ON "MobileRefreshToken"("userId", "revokedAt");
CREATE INDEX "MobileRefreshToken_expiresAt_idx"
    ON "MobileRefreshToken"("expiresAt");

ALTER TABLE "MobileRefreshToken"
    ADD CONSTRAINT "MobileRefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma is the only access path. Keep device credentials inaccessible through
-- Supabase's public Data API even when the public schema is exposed.
REVOKE ALL ON TABLE "MobileRefreshToken" FROM anon, authenticated;
ALTER TABLE "MobileRefreshToken" ENABLE ROW LEVEL SECURITY;
