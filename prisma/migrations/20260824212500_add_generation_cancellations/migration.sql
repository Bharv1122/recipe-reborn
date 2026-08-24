-- Persist cancellation markers so the cancel route and generation stream can
-- coordinate even when Vercel runs them in different serverless instances.
CREATE TABLE "GenerationCancellation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationCancellation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenerationCancellation_userId_generationId_key"
ON "GenerationCancellation"("userId", "generationId");

CREATE INDEX "GenerationCancellation_expiresAt_idx"
ON "GenerationCancellation"("expiresAt");

ALTER TABLE "GenerationCancellation"
ADD CONSTRAINT "GenerationCancellation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
