-- Read-only aggregate check for the September 12 first-user campaign.
-- Existing attribution, partner codes and untagged signups can fall outside this cohort.
-- Recipe rows include saved/generated meal-plan records; they do not prove cooking.
-- Apply the private volunteer log to exclude owner/test activity before reporting users.
WITH cohort AS (
  SELECT id, "createdAt", "signupSource"
  FROM "User"
  WHERE "signupSource" IN ('first10-sep12-facebook', 'first10-sep12-stephanie')
    AND "createdAt" >= timestamptz '2026-09-12 00:00:00-07'
), first_recipe AS (
  SELECT c.id, min(r."createdAt") AS first_saved_at
  FROM cohort c
  LEFT JOIN "Recipe" r ON r."userId" = c.id AND r."createdAt" >= c."createdAt"
  GROUP BY c.id
)
SELECT
  c."signupSource" AS source,
  count(*) AS new_accounts,
  count(*) FILTER (WHERE f.first_saved_at IS NOT NULL) AS accounts_with_saved_recipe,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM "Recipe" r
    WHERE r."userId" = c.id
      AND r."createdAt" >= f.first_saved_at + interval '24 hours'
      AND r."createdAt" <= f.first_saved_at + interval '7 days'
  )) AS accounts_saving_again_after_24h_within_7d
FROM cohort c
JOIN first_recipe f ON f.id = c.id
GROUP BY c."signupSource";
