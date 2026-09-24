# Mobile privacy and data-use inventory

This is an engineering inventory for store forms, not final legal wording.

| Data | Purpose | Storage / sharing | User control |
| --- | --- | --- | --- |
| Email, password | Account signup and login | Password is sent over HTTPS and stored only as the existing bcrypt hash; the app does not retain it | Password reset and in-app account deletion |
| Access/refresh tokens | Maintain signed-in session | Device Keychain/Keystore; refresh-token hash and device label in Recipe Reborn Postgres | Sign out revokes the device token |
| Cached account identity | Open the user's cached shopping lists after an offline restart | User ID, name, email, allergies and dislikes in device Keychain/Keystore; no cached Premium/trial entitlement | Cleared on sign-out, replacement sign-in or explicit session rejection |
| Subscription/trial status | Enforce and display existing access | Existing Recipe Reborn account and Stripe-derived server state; the iPhone app is read-only and exposes no purchase or billing-management control | Billing changes are outside the iPhone app for version 1 |
| Allergies/disliked ingredients | Recipe safety and personalization | Existing Recipe Reborn account; never used to grant access | Editable on web until native profile editing is built |
| Barcode | Product lookup | Sent to Recipe Reborn server, then Open Food Facts | Scanning is user initiated |
| Package-label and fridge/pantry photos | Ingredient extraction | User-selected photos are sent over HTTPS to Recipe Reborn and its AI processor for the requested analysis; Recipe Reborn does not save the source photos | User reviews/corrects extracted ingredients before use or inventory saving |
| Package nutrition and inferred recipe nutrition | Compare reviewed label facts with estimated homemade values | Recipe ingredients, instructions and serving count go to Google Gemini; the estimate endpoint is stateless; saving a recipe stores its available comparison snapshot in the account database | Unknown values remain null; estimate failure can be saved explicitly without an estimate |
| Microphone audio and transcript | User-requested voice input | A temporary on-device audio clip is sent over HTTPS to Recipe Reborn and the configured transcription processor; the server returns text without saving the clip; native cleanup removes the temporary clip after completion/cancellation where available | Tap to record; microphone permission is optional; stop/cancel and typing remain available; no background recording |
| AI Chef messages | User-requested cooking assistance | Recent message text is sent over HTTPS to Recipe Reborn and its AI processor; up to 40 messages are retained per account in on-device SQLite; the server does not persist the conversation | Sending is user initiated; the chat's clear-history action removes that account's local history |
| Shopping lists | Offline shopping | Existing server data plus an on-device SQLite cache and queued check-offs | Signing in or out clears the prior local cache |
| Notification permission, reminder, optional device push token | User-requested reminders | Local reminders stay on device. If the user enables push after EAS setup, a device token is stored in Recipe Reborn Postgres | OS settings, sign out, and the protected token deletion endpoint |
| Diagnostics/analytics | Reliability | No mobile analytics or crash SDK has been added | Decide with consent/privacy review before beta |

Camera, microphone and notification permissions are requested in context, not at first launch. No contacts, precise location, advertising identifier, health API or tracking permission is requested.

Static package and source review on August 26, 2026 found no native analytics, crash-reporting, advertising, or tracking SDK. Reconcile this inventory against the final signed binary before answering App Store Connect privacy questions.

September 23 source reconciliation adds microphone/transcript processing, persistent local chat history and the secure offline identity cache. Processor retention and sharing classifications still need confirmation against the actual production provider terms and final store questionnaires; do not infer that third-party processors retain nothing from the absence of Recipe Reborn database storage.

## September 23 public-policy reconciliation

- Current AI endpoints in `lib/ai.ts` are Google Gemini. Generation and AI Chef include the account's saved allergies and dislikes in the provider request. Recipe nutrition estimates describe food; they are not measurements of the user's body or medical condition. Saved allergies are nevertheless sensitive health-related user information and need separate classification review.
- Photo conversion creates a bounded temporary JPEG upload copy and attempts to remove it afterward; it does not delete the original library photo. Voice input similarly attempts to remove its temporary clip. Source-media absence from the Recipe Reborn database does not establish provider deletion or memory-only processing.
- Shopping snapshots and queued check-offs are ordinary SQLite data, distinct from SecureStore credentials/cached identity. AI Chef history is also SQLite, scoped to the account, and is resubmitted as recent conversational context when a new question is sent. Do not describe all local storage as encrypted SecureStore or say closing chat clears it.
- Live `/privacy`, `/support`, `/account-deletion`, and `/terms` returned HTTP 200 on September 23. The live privacy revision was August 12 and omitted current audio/local-cache behavior. The corrected privacy source is prepared separately; its publication must be verified after deployment.
- Account deletion's local chat cleanup was escalated to the native owner after a source gap was found. Do not claim that fix is in a signed binary until its implementation and build are verified.

See `store/PLAY-DATA-SAFETY-RECONCILIATION.md` for the form matrix, provider questions, reviewer access, and source pointers. This inventory does not certify existing Console answers.
