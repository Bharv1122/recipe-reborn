# Recipe Reborn check-in — September 23, 2026

**Later update:** Beth authorized “push all fixes.” All seven commits through `938a76a` are now pushed, and `recipereborn.com` is verified at READY deployment `dpl_46Kyts82vznJCgnH5dWYzfeQRks5`. The earlier “local/not deployed” observations below describe the pre-release check. See [push verification](C:/Users/bethh/Documents/recipe-reborn/outputs/releases/recipe-reborn-push-verification-2026-09-23.md) for exact scope and current checks. Native store releases and social posting remain separate and were not performed.

## Verified live

- The production alias `recipereborn.com` resolves in Vercel to READY deployment `dpl_J77CGno2ZTijoqYkC1LLYpGBYLU7`, commit `d54b35063f14a2fc02286a5c306ece0ebc8c8f4a` from September 7. The newer local commits have not reached this deployment.
- Both proposed source-tag landing links, signup, pricing and the existing brand image return HTTP 200. The browser renders the current signup form and the offer: **3 recipes a month, no card required**.
- The existing signed-in browser session loads the generator and its label/barcode/type/import/voice controls. No production account was created, preferences changed, subscription modified, or paid recipe generation invoked for this pass. A fresh account through a complete generated recipe has not been re-tested end to end here.
- Anonymous HTTP requests show the public landing page and sign-in path. Browser inspection used the existing signed-in session, so it does not establish the entire guest-to-signup flow.

## Current aggregate baseline

Read-only Supabase aggregate queries against the Recipe Reborn project on September 23:

| Category | Accounts | Accounts with any saved recipe |
| --- | ---: | ---: |
| Known owner | 1 | 1 |
| Synthetic `@example.com` accounts | 3 | 2 |
| Remaining accounts, not independently verified | 12 | 8 |
| Total | 16 | 11 |

There are **0 accounts created since September 7, 00:00 UTC**, including **0 since September 12**. Since September 12, 00:00 UTC, there is 1 saved Recipe record from 1 account; both counts are **0 after excluding the known owner and synthetic category**. These results describe database activity, not proof of independent users, cooking, or customer retention. Other tester or duplicate accounts can remain among the 12.

No customer emails, recipe content, payment details, or individual activity were retrieved into this report. Anonymous analytics from QA and owner visits must not be presented as audience growth.

## Completed local fix

A controlled regression reproduced an onboarding stall: `/api/signup` succeeded, but `signup_completed` analytics had to finish before automatic sign-in could run. A stalled analytics request left the user waiting despite the account already existing. The same pattern kept food preferences displaying a saving state after they were saved successfully.

Both handlers now send the optional analytics event without waiting. The analytics helper still catches failed requests and keeps requests alive across navigation. Actual signup errors, sign-in fallback, source attribution and preference-save errors retain their existing behavior. This is a local change and is not live.

Files: `app/signup/_components/signup-form.tsx`, `app/account/page.tsx`, `scripts/verify-onboarding-analytics.cjs`.

Committed locally as **938a76a — Keep optional analytics from blocking onboarding**. Only these three files were staged. The promotion packet, private aggregate check-in and measurement SQL remain local review artifacts under `outputs/growth`; unrelated baseline changes were preserved. Main is now seven commits ahead of the production SHA, with no push performed.

## Validation

- Before the fix, the regression failed on stalled signup analytics, stalled preferences analytics, and login fallback behind stalled analytics.
- After the fix, all 9 controlled component-handler scenarios pass: pending, failed and successful analytics for both forms; unsuccessful API saves; and signup login fallback. The tests also verify source forwarding, no false successful-signup event after an API error, and loading-state recovery. Network responses and React hooks are controlled; this is not a physical-device or full browser E2E test.
- `node scripts/verify-visit-tracking.cjs` passes. Its initial sandbox run could not read parent directories; the authorized local run passed.
- Scoped ESLint completes with no errors and one pre-existing unused `ExternalLink` import warning in the account page. No unrelated cleanup was made.
- `npm run build` passes, including TypeScript, page generation and route output. This generates local artifacts only; it does not deploy.
- React review: the changed callbacks keep their existing state handling, error handling, markup and accessibility. Only optional telemetry was removed from the awaited flow.
- Both campaign tags pass the actual attribution resolver in current source and production commit d54b350, with no partner offer granted. The prepared read-only SQL was executed successfully and returns zero for both unpublished campaign cohorts.

## Remaining finish line

1. Choose a web release scope and approve deployment. At the start of this pass main was six commits ahead of the production SHA. Pushing main would include that older work as well as this fix; do not treat it as a two-line-only production patch. The return-visit correction `e309dfd` is also local.
2. After release, verify a fresh-account first recipe with a permitted test account and distinguish test events from the campaign. No claim is made here that the full new-user/AI response path passed live.
3. Approve the prepared post and exact account. Publish the web invitation first, then measure first recipe and return use; keep app-sale outreach paused.
4. Native Android is separately owned. The coordinator's current report says closed Alpha build 8, 2 opted-in testers, production inactive. At least 12 must remain opted in continuously for 14 days before applying for production access. The Android owner subsequently verified the current email-list enrollment route and official opt-in link; those steps are now included in the promotion packet. The selected list has 14 addresses, which is distinct from the 2 opted-in testers. The test is US-only. An owner must add an unlisted volunteer before their link grants access; no tester-list changes were performed. Do not advertise public Play availability or unshipped native voice/photo changes.

No deployment, push, store build/upload, social post, message to prospects, billing action or purchase was performed. Unrelated local work, including the dirty CLAUDE.md and existing untracked outputs, was preserved.
