CREATE TABLE IF NOT EXISTS "FunnelEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "path" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FunnelEvent_eventName_check" CHECK ("eventName" IN (
      'preview_started',
      'signup_viewed',
      'signup_completed',
      'profile_completed',
      'recipe_generated',
      'return_visit'
    )),
    CONSTRAINT "FunnelEvent_path_length_check" CHECK ("path" IS NULL OR char_length("path") <= 120),
    CONSTRAINT "FunnelEvent_source_length_check" CHECK ("source" IS NULL OR char_length("source") <= 60)
);

CREATE INDEX IF NOT EXISTS "FunnelEvent_eventName_createdAt_idx" ON "FunnelEvent"("eventName", "createdAt");

ALTER TABLE "FunnelEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "FunnelEvent" FROM anon, authenticated;
