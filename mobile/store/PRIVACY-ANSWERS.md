# Store privacy answer worksheet

This engineering worksheet must be reviewed against the final signed build before submission.

## Apple privacy labels

- Contact Info / Email Address: collected, linked to identity, app functionality and account management; not used for tracking.
- User Content / Photos: collected when the user submits package-label or pantry/fridge photos for requested AI processing; linked to the signed-in request; source photos are not stored by Recipe Reborn; app functionality; not tracking.
- User Content / Audio Data: optional microphone clips are submitted for requested transcription, linked to the signed-in request; Recipe Reborn returns text without saving the audio; app functionality; not tracking. Review the configured processor's retention terms and final questionnaire classifications.
- User Content / Other User Content: ingredients, recipes, confirmed pantry inventory, meal plans, collections, shopping lists, and user-submitted AI Chef messages; linked to identity for request processing; app functionality; not tracking.
- Identifiers / User ID and device token: linked to identity; authentication, security, and optional notifications; not tracking.
- Purchases: existing subscription state is linked to identity for entitlement display and account management; not tracking. Version 1 does not initiate purchases or billing changes in the iPhone app.
- Diagnostics: no native crash or analytics SDK in this beta foundation.

Static source and package review completed August 26, 2026. Recheck every answer against the final signed binary and the then-current App Store Connect questionnaire before submission.

## Google Play Data safety

- Data encrypted in transit: Yes (production HTTPS only).
- Account deletion: Available in app and documented at https://recipereborn.com/account-deletion.
- Data sold: No.
- Processing inventory for final sharing classifications: User-submitted ingredient text, AI Chef messages, package-label/pantry/fridge photos and microphone audio are processed by the configured AI/transcription service to provide requested features; barcode queries use the server's product-data provider. Existing subscription state is displayed in the native app; native purchase/billing controls are absent. Confirm actual processor terms and applicable service-provider classifications before answering the Play form.
- Optional data: microphone, camera/photo selection and push permission are user initiated. Core account email and session data are required for signed-in features. On-device identity caching supports offline shopping; it does not grant account access or Premium.
- Independent security review: do not claim until one is completed.

September 23 source update: reconcile Audio files / Voice or sound recordings and Photos against the exact signed binary before updating Play Data safety. The older August worksheet did not cover voice input. These notes do not certify the existing published forms.

The current detailed Play matrix is [PLAY-DATA-SAFETY-RECONCILIATION.md](./PLAY-DATA-SAFETY-RECONCILIATION.md). It also includes chat text, allergy information, saved nutrition comparisons, local-cache boundaries, current public URLs, and reviewer-access checks. For Gemini-processed data, do not answer ephemeral processing Yes: the published provider terms allow retention beyond the immediate request. Do not select No sharing solely because the Recipe Reborn route does not store the source upload.

Current release-owner evidence confirms the Recipe Reborn Gemini project `gen-lang-client-0038290289` is linked to Paid 1 / Tier 1 Prepay, and the production-environment API key privately matched that project's key metadata (boolean match only; no secret printed). The supported AI-content answer is **Collected Yes / Shared No (service-provider exception) / Ephemeral No**. The public policy still names Google Gemini; the exception is specific to the Play form. The paid-provider check is resolved; other recipients require their own classification.
