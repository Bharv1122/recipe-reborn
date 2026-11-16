# Saved recipe comparison — September 23, 2026

Implemented locally: native save now includes a versioned snapshot of source, original package nutrition and the available homemade estimate. The saved-recipe screen displays that snapshot without another AI request. Unknown numbers remain unavailable; unreviewed scans remain unreviewed. Ingredient edits through the web API clear the old homemade estimate while retaining package facts.

Validation completed:

- Real API handlers against an isolated JSON-round-tripping repository double: save/reopen, zero/null preservation, invalid data rejection, ownership filtering, anonymous rejection, legacy client saves, notes preservation and ingredient-change invalidation.
- Actual native screen components rendered with simulated services in a browser: scan → generate → save → reload → reopen in four cases (confirmed package, unconfirmed scan, no package nutrition, estimate failure). No extra estimate requests when reopening. No page errors or horizontal overflow at 390 px. Screenshots visually reviewed.
- Mobile TypeScript and lint passed.
- Full Next.js production build passed.
- Android JavaScript export passed (1,428 modules).

Run regression: `npm run verify:recipe-comparison`.
Browser harness: `node outputs/flow-preview/build.mjs`, `node outputs/flow-preview/server.cjs`, then `node outputs/comparison-qa/verify-browser.cjs`.

## Release dependency

The generated Prisma migration adds one nullable JSONB column to Recipe. It has **not** been applied to a database. Apply that additive migration and verify the actual database round trip before deploying the API, then build/distribute the matching native candidate. Do not deploy an API/client generated against the new column to an unmigrated database.

No database was modified, no release was pushed, and no new cloud build was purchased. API tests used a repository double, not PostgreSQL. Browser tests are not physical-device tests.

The existing signed Android build 10 was downloaded and installed separately to test its already-built microphone repair. It does **not** contain these new comparison persistence changes.

## Later release preparation

The owner resumed Recipe Reborn as priority #1. Hermes independently reproduced
and reviewed the save-before-estimate repair, and invalid optional serving counts
are now normalized. See REVIEW-AND-FIX-RESULTS.md for exact tested scope.

Production migration history for two already-existing September changes was
reconciled after checking the actual columns, indexes, foreign key, RLS and client
grants. Prisma then successfully applied 20260923225209_save_recipe_comparison.
The real production Recipe.comparisonSnapshot column is nullable JSONB.

verify-production-column.cjs passed an actual PostgreSQL save/reopen with nested
comparison values, nulls and zeros inside a rolled-back transaction. No synthetic
user remained. This supersedes the earlier not-applied entry; deployment and
signed-device comparison verification remain separate and pending.
