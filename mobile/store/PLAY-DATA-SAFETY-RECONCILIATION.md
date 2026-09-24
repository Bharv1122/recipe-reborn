# Recipe Reborn — Play privacy reconciliation

Prepared September 23, 2026 against current source. Package: `com.recipereborn.app`. The actual saved Play Console responses are unavailable; this is an answer matrix to reconcile with them, not a claim that the form was changed. The separate QA package is not the Play artifact. Existing EAS submission configuration targets **alpha**, so this is closed testing rather than an internal-only release.

## Minimum form changes to check

Set collection to **Yes** for the submitted audio-capable app. Keep production transit encryption **Yes**, with the HTTPS production configuration verified on the final build. Account deletion is available in-app and at `https://recipereborn.com/account-deletion`; verify the pending local-chat cleanup in the final native candidate. Do not claim independent security certification.

Purpose abbreviations in the matrix: F = App functionality; P = Personalization; A = Account management; S = Fraud prevention, security, and compliance. These are engineering mappings of this app's actual flows to the [official form definitions](https://support.google.com/googleplay/android-developer/answer/10787469).

| Data type | Collected | Optional? | Ephemeral? | Purpose | Evidence and change |
| --- | --- | --- | --- | --- | --- |
| Audio files → Voice or sound recordings | Yes | Yes | No | F | Add if absent: native microphone clip goes to `/api/transcribe-audio`, then Gemini. Typing remains available. |
| Photos and videos → Photos | Yes | Yes | No | F | Include both label/recipe and fridge/pantry uploads; not only fridge scans. No video feature was found. |
| Messages → Other in-app messages | Yes | Yes | No | F, P | AI Chef sends up to 20 recent messages plus saved food preferences to Gemini. Local history persists up to 40 messages. |
| App activity → Other user-generated content | Yes | No for recipe input used by the core recipe feature; optional for notes and other extra content | No | F, P | Ingredients, reviewed inventory, recipes, lists, reports, recipe notes, and saved nutrition comparisons. Audio transcripts become this content or chat text when the user uses them. |
| Personal info → Email address, User IDs | Yes | No for signed-in features | No | F, A, S | Existing account/login/session flow. Retain these declarations; offline cache is an additional local copy, not a new recipient. |
| Personal info → Name | Reconcile existing profile handling | Yes | No if collected | F, A | Optional existing profile name is returned to the app and cached. Native signup does not ask for a name; do not claim a new native name upload. |
| Health and fitness → Health info | Include saved allergies and any health-specific dietary information processed for native AI requests | Yes | No | F, P | Allergy strings are stored on the account and added by the server to recipe/chat prompts. Generic nutrient estimates about food are not themselves personal medical measurements. |
| Device or other IDs | Yes when push registration is used | Yes | No | F | Optional Expo push token is sent to the backend; device label/platform also accompany login and push registration. Do not classify an advertising ID: none is requested in the inspected source. |

For the AI-content transfer to **paid Gemini**, the supported classification is **Collected = Yes, Shared = No under the service-provider exception, Ephemeral = No**. The release owner confirmed the production key matches the verified billing-linked project. This is an inference from the paid-content processing agreement and Play's exception, not a claim that content stays on Recipe Reborn's servers. Apply it to voice, photos, chat, ingredient/recipe content and allergy preferences sent for the requested feature. It does not establish a blanket answer for other recipients or SDKs. Keep the actual recipient disclosed in the privacy policy. The native code does not sell data or use advertising/tracking SDKs in this audit.

Local-only processing does not create a separate off-device collection category. A transient backend implementation alone does not justify ephemeral processing when a downstream provider can retain the content. The [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469) defines those boundaries and requires coverage for closed testing.

Existing subscription entitlement is returned to the native client; there is no native card entry or purchase control in the reviewed flow. Reconcile any existing purchase-history declaration against all active versions and actual billing integration. Do not add card-number collection merely because an account has Premium. No native analytics or crash SDK was found; that does not prove server operational logs or website analytics are absent. Review those existing declarations without adding guessed purposes.

## Provider evidence — key association confirmed

Source points to the Google Gemini API, not an unknown generic processor. Current [Gemini terms](https://ai.google.dev/gemini-api/terms#how_google_uses_your_data) distinguish service configurations: paid API access requires an active billing association; paid-service content has a processing agreement and limited safety logging, while unpaid-service content can be used for Google's improvement and human review. The terms also restrict sensitive content on unpaid services. No account-tier or zero-retention assertion follows from the source code.

The release owner inspected signed-in Google AI Studio billing: **Paid 1 / Tier 1 Prepay**, with Recipe Reborn project `gen-lang-client-0038290289` linked to the existing active billing configuration. Chef Doggo is a separate linked project. Existing credit was present and auto-reload was off; no billing setting was changed.

The release owner privately compared `GEMINI_API_KEY` from the production-environment configuration with the observed Recipe Reborn key metadata; the result was **match = true**. Only that boolean was reported. No key value appears in this worksheet, and no key was replaced. The paid-project association check is resolved. Use Shared = No for the Gemini content transfer on the service-provider basis above; Google's limited safety logging means Ephemeral remains No. No account change, purchase or legal agreement acceptance was performed.

## Public policy and access pages

Live checks on September 23 returned HTTP 200 for [Privacy](https://recipereborn.com/privacy), [Support](https://recipereborn.com/support), [Account deletion](https://recipereborn.com/account-deletion), and [Terms](https://recipereborn.com/terms). Privacy still showed August 12 and omitted voice, label-photo processing, persistent mobile chat and cached identity. `app/privacy/page.tsx` now has a prepared September 23 revision with these flows, saved comparisons, Google Gemini naming, accurate password hashing, and no promise of immediate provider deletion. This audit did not deploy it.

Use support URL `https://recipereborn.com/support` and support contact `support@recipereborn.com`. Account deletion is a separate field, not the support landing page. The prepared deletion-page update distinguishes mobile deletion from subscription cancellation through the original purchase service, and links website purchasers to web Account → Manage Subscription. Its live publication still needs verification.

No public app-access page is required for credentials; reviewer access belongs in the protected Play Console App access section. Current native signup/sign-in exist, and generation is entitlement-gated. Supply a dedicated synthetic reviewer account with durable access to all reviewed features, no expiring trial/one-time-code dependency, and English instructions. Do not put its password in repository documents. These requirements follow [Google's reviewer sign-in guidance](https://support.google.com/googleplay/android-developer/answer/15748846).

Suggested protected review instructions: sign in with the supplied reviewer account; test typed ingredients and optional Speak my ingredients; submit a synthetic label or pantry photo, review the result, generate and save; reopen the recipe to see the saved comparison; open AI Chef and clear its history; load Shopping online, check an item offline, reconnect and refresh; open Account for privacy, notification controls and deletion. Confirm the reviewer entitlement and sample account actually work on the chosen AAB before supplying these instructions.

### Minimal verification of the existing protected reviewer access

1. The release owner opens the existing Play Console App access entry for this production package. Confirm credentials and English instructions are present without copying the password into reports, screenshots, shell commands, or repository files.
2. Privately use that existing account in a fresh sign-in on the final candidate against production. Record only whether sign-in succeeded and whether an OTP, invitation, geography restriction, or new-account step blocked access. Do not create another reviewer account or reset its password as part of this check.
3. Check its server-backed entitlement and expiry. Confirm that a review will not depend on a short-lived trial or payment. Use a single synthetic ingredient request to prove the protected generation path is accessible, then save/reopen the result; this checks reviewer access without repeating every already-passed device test.
4. Confirm the instructions reach voice/photo, AI Chef, offline Shopping and Account screens as appropriate to the exact candidate. Open deletion instructions only; do not delete the durable reviewer account. Destructive deletion QA uses a separate disposable test account.
5. Record candidate build ID/version, time, login pass/fail, entitlement sufficient/insufficient, generation/save/reopen pass/fail, and any specific access blocker. Keep credential values exclusively in the protected Console entry. This is a plan until those outcomes are observed by the release owner.

## Age targeting reconciliation

The [current Gemini Age Requirements](https://ai.google.dev/gemini-api/terms#age_requirements) prohibit API clients directed toward or likely accessed by under-18s. At audit start, live privacy said under-13s only, and native/web signup had no age question. The release owner then inspected the current Play target audience: only **18 and over** is selected; younger groups and the optional Google minor-block setting are unchecked. The release owner authorized an unchecked 18+ confirmation in both signup screens and server rejection unless `adultConfirmed` is literal `true`. The prepared change stores no birth date or age field and changes no existing account data. It is a user confirmation, not age verification, and does not establish an age for existing users. Older app versions without the confirmation must update or use the website to create an account after the server change; existing-account login is unchanged.

## Source evidence

- Voice: `mobile/src/components/voice-input.tsx`; `app/api/transcribe-audio/route.ts`; `lib/ai.ts`.
- Photos: `mobile/src/services/photo-upload.ts`; `app/api/extract-recipe-from-photo/route.ts`; `app/api/pantry-inventory/extract/route.ts`.
- Nutrition: `app/api/nutrition/estimate/route.ts`; `mobile/src/app/generate.tsx`; `app/api/mobile/recipes/route.ts`.
- Profile/preferences: `mobile/src/services/auth-storage.ts`; `mobile/src/providers/auth-provider.tsx`; `app/api/generate-recipe/route.ts`; `app/api/mobile/chat/route.ts`.
- Local content: `mobile/src/services/chat-history.ts`; `mobile/src/app/chat.tsx`; `mobile/src/services/shopping-cache.ts`.
- Push: `mobile/src/services/notifications.ts`; `app/api/mobile/push-tokens/route.ts`.
- Account deletion: `mobile/src/app/delete-account.tsx`; `app/api/mobile/account/delete/route.ts`; `prisma/schema.prisma`.

## Outstanding actions

1. Paid Gemini key association is resolved; use the supported AI-content answers above and reconcile any other recipients separately.
2. Verify the native deletion cleanup, adult-audience handling, and all disclosures against the final candidate.
3. Deploy the corrected public privacy page through the release owner's process and verify its live text and links.
4. In Play Console, open App content → Data safety, compare/export current answers, apply the matrix, review the preview and save/submit; update App access, target audience, privacy and deletion URLs as needed. The release owner regained Console access during this audit and owns those changes. EAS credentials/submission history cannot read or amend these forms.
5. Verify reviewer credentials and access privately. Do not submit an untested production AAB or expose a password in the worksheet.

Google requires the policy, in-app behavior, and form to agree, including a public account-deletion route; see the [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311). Source and public-page checks do not certify the unread Console settings.

## Local verification completed

- `node scripts/verify-signup-adult-confirmation.cjs`: actual API handler with isolated repository/rate-limit doubles rejects absent, false, null, string, numeric, object and array confirmation before any account lookup/write; accepts literal true; retains password validation; stores no date of birth or new age field.
- `node scripts/verify-onboarding-analytics.cjs`: actual web signup handlers begin unchecked/disabled, reject direct submit before confirmation, then send true after selection; existing analytics-failure/attribution/sign-in behavior still passes.
- `node scripts/verify-mobile-signup.cjs`: mobile owner reports actual UI, guard and provider-payload checks pass.
- Targeted ESLint on both policy pages, web signup and signup API passed. Both policy pages rendered to static markup, with eleven content/link checks and no external requests.
- Synthetic API callers in `verify-ai-features.ts` and `verify-mobile-production.ts` now include explicit confirmation; this task did not run those scripts against production or create any real account.
- Public-page baseline was checked separately over HTTPS. Deployment, final build/device confirmation, current provider account review, and Console changes remain owned by the release coordinator.
