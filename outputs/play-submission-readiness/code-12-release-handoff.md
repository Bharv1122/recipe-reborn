# Recipe Reborn Android 12 — release handoff

Prepared September 23, 2026. This is a checklist and draft, not a release claim.

**Superseded as the final submission candidate:** the final Play audit found
missing in-app AI-content reporting. Code12 artifacts are valid for regression
QA, but do not submit the code12 AAB below. Reviewed reporting requires code13;
its exact build IDs will be recorded separately after construction.

## Exact candidates

| Candidate | Package | Build ID | Source |
| --- | --- | --- | --- |
| Physical QA APK | com.recipereborn.app.qa | 6a33ab60-72cd-4341-8eca-31d1810e0408 | a954868219f1a18b1c4ebdb7a54868f569a1e1b0 |
| Play AAB | com.recipereborn.app | 4fd3aa73-2ddd-4548-a029-ddf9b6e91669 | 9c7ccfe8fed007707230dfc3994d19551ea9a475 |

Both request version code 12. The 101 native/shared source hashes match.
Before installation/submission, record the completed artifact SHA256, package,
version code and signing-certificate continuity from the downloaded binary.
Preserve the existing production app and retained QA account data.

## Remaining physical checks

1. Install the QA APK as an update to the QA package; confirm version 12 and
   retained sign-in. The production package must remain untouched.
2. Recheck real voice and pantry camera on the new binary. Build 11 already
   passed both with owner confirmation; record a separate result for build 12.
3. Scan a barcode and a label/photo; include a large gallery image. Review and
   correct extracted ingredients before generating a recipe.
4. Generate, wait for nutrition, save, reopen, and verify the original/fresh
   comparison. Unknown values must remain unknown rather than becoming zero.
5. Add the recipe to a meal plan and shopping list. Load shopping online,
   disconnect, check items, fully close/reopen the app offline, then reconnect
   and refresh. Confirm checked states survive and sync.
6. Check AI Chef history and clear-history behavior. Account deletion testing
   must use a dedicated disposable account, never the owner's or durable
   Google reviewer account. Source-level SQLite cleanup race tests already pass.

Use a clear pass/fail/blocked result for each check. A successful source export,
cloud build, API test or older-binary test is not a substitute for these checks.

## Google Play steps after the candidate passes

- Submit only the exact verified production AAB build ID above using the
  existing EAS play-alpha profile. Never use a floating latest-build selection.
- Confirm the uploaded package/version in Console and inspect any release
  errors, warnings and pre-launch findings.
- Combine the new closed-test release with the already-saved Data safety
  changes in Publishing overview, then submit for Google review.
- Preserve the existing protected reviewer credentials and English access
  instructions. The durable account is active Premium without an expiry.
  Do not copy its password into artifacts or reset it as part of release work.
- Verify review outcome and actual tester availability separately from EAS
  upload completion. The closed test currently has 2 opted-in testers; the
  Console requires 12 continuously opted-in testers for 14 days before the
  production-access application can be made.

## Draft English release notes

Speak your ingredients or photograph your pantry to get started. This update
improves audio transcription and photo handling, keeps recipe comparisons when
you save and reopen them, and makes shopping lists more reliable offline.
It also improves account recovery, deletion cleanup and privacy information.
New accounts confirm that the user is 18 or older.

## Current dependency

The Note20 is disconnected from ADB. The owner has been asked to reconnect it.
The phone check and the exact completed binaries remain prerequisites for the
new Play submission. Current web/backend commit 9c7ccfe is live and the full
synthetic production API suite passed with test-account cleanup.
