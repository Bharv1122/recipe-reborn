# Comparison save reliability — verified September 23, 2026

The confirmed save-before-estimate race is fixed in the actual native components. Both save buttons and the handler reject saving while the estimate is pending. A success saves the estimate; a definite failure or 45-second timeout enables the explicit **Save without nutrition estimate** action. Retry returns both buttons to pending. Aborted, timed-out, and replaced requests cannot overwrite the current recipe.

The scanned optional serving-count field now normalizes missing, zero, negative, nonfinite, and unreadable values to null. Positive numbers and positive fractions are preserved. Nutrient zero values remain valid; this rule applies only to servings per container.

## Evidence

- `node outputs/comparison-qa/verify-estimate-save-lifecycle.cjs` — passed five grouped checks using actual GenerateScreen, RecipeComparison, and saved Detail components: both-button and direct-handler pending rejection; successful save/reopen without another estimate request; deliberate null save on failure; retry; timeout; late response after timeout; replaced recipe isolation; timer cleanup. Seven estimate requests and five saves used isolated doubles, with no network or database writes. Evidence: `estimate-save-lifecycle-results.json`.
- `npm run verify:recipe-comparison` — passed actual API-handler save/reopen, validation, ownership, anonymous rejection, legacy save, notes preservation, and ingredient-change invalidation checks against a JSON-round-tripping repository double. Added ten scanned serving-count conversion/save/reopen cases: missing, null, zero, negative, NaN, infinity, unreadable, 2.5, string 3.5, and 8.
- Browser component verification — passed the existing four cases: confirmed barcode nutrition, unconfirmed scan, absent package nutrition, and failed homemade estimate. Save/reload/reopen made no additional estimate request; no page errors or horizontal overflow at 390 px.
- `npm run typecheck` and `npm run lint` in `mobile` — passed after the pending-state implementation and lint cleanup.
- `git diff --check` for the changed native component files — passed (Git reports existing LF-to-CRLF policy notices).

Historical evidence in `save-before-estimate-reproduction.json` records the original bug. Its reproduction script deliberately expects the old broken behavior; use the lifecycle regression above to verify the fix.

## Independent review

Hermes Agent v0.15.1 ran with the installed **gpt-5.5** model through **openai-codex**. It is the Hermes agent runtime using that model. Only allowlisted relevant source was included; the runs had no file, execution, or browser tools, no imported project instructions/memory, and no personal or environment files. Exact session metadata in `hermes-model-evidence.json` confirms zero tool calls and included subscription billing.

- Initial comparison review independently found the same save race: `hermes-comparison-review.stdout.txt`.
- Focused fixed-component review approved the fix and found no new actionable defect: `hermes-final-comparison-review.stdout.txt`.
- A final supplement reviewed the exact final component sources plus the serving-count helper after lint cleanup and normalization. Verdict: **Approve; no actual actionable defects**. Evidence: `hermes-final-supplement-review.stdout.txt`; exact file hashes: `hermes-final-supplement-manifest.json`.
- Separate audio review found no clear blocker, but reported medium robustness gaps for empty/blocked output, truncated output, and timeout classification: `hermes-audio-review.stdout.txt`. These were reported to the release owner; this subtask did not edit the audio route.

Each review has its original request, source hash manifest, raw stdout/stderr, and run metadata in this folder.

## Scope and release boundary

These are local source and isolated regression results. No database migration, commit, push, cloud build, distribution, or publication was performed by this subtask. Physical-device microphone/photo checks reported by the release owner concern the existing audio repair, not this new comparison save change. The release owner is handling the additive database migration, production API verification, and matching native build. A slow/failing nutrition estimate should still receive a physical-device smoke test on that new native candidate before its release.
