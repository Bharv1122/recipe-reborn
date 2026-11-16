-- Read-only aggregates. No identities or recipe content are returned.
-- These are account/saved-record measures, not proof of cooking or unique people.
-- First-touch storage and typed community codes can under-attribute a campaign.
WITH sources(source) AS (
  VALUES ('rr-sep23-personal'), ('rr-sep23-page')
), cohort AS (
  SELECT id, "createdAt", "signupSource"
  FROM "User"
  WHERE "signupSource" IN (SELECT source FROM sources)
    AND "createdAt" >= timestamptz '2026-09-23 00:00:00-07'
    AND lower(email) <> 'bethharvey11@gmail.com'
    AND lower(email) NOT LIKE '%@example.com'
), first_recipe AS (
  SELECT c.id, min(r."createdAt") AS first_saved_at
  FROM cohort c
  LEFT JOIN "Recipe" r ON r."userId" = c.id AND r."createdAt" >= c."createdAt"
  GROUP BY c.id
)
SELECT
  s.source,
  count(c.id)::int AS new_accounts,
  count(c.id) FILTER (WHERE f.first_saved_at IS NOT NULL)::int AS accounts_with_saved_recipe,
  count(c.id) FILTER (WHERE EXISTS (
    SELECT 1 FROM "Recipe" r
    WHERE r."userId" = c.id
      AND r."createdAt" >= f.first_saved_at + interval '24 hours'
      AND r."createdAt" <= f.first_saved_at + interval '7 days'
  ))::int AS accounts_saving_again_after_24h_within_7d,
  count(c.id) FILTER (WHERE f.first_saved_at <= now() - interval '7 days')::int
    AS accounts_with_full_7d_observation
FROM sources s
LEFT JOIN cohort c ON c."signupSource" = s.source
LEFT JOIN first_recipe f ON f.id = c.id
GROUP BY s.source
ORDER BY s.source;
