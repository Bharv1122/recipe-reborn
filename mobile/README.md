# Recipe Reborn native foundation

Expo SDK 57 / React Native app for iOS and Android. This is a native client, not a WebView. The Next.js app remains the system of record for accounts, subscriptions, trials, allergies, recipe safety, and customer data.

## Run locally

Requirements: Node.js 22.13 or newer, npm, and the Recipe Reborn backend environment.

1. Apply the pending `MobileRefreshToken` migration to a non-production database.
2. Run the web API from the repository root: `npm run dev`.
3. Copy `.env.example` to `.env.local` in this folder.
4. Set `EXPO_PUBLIC_API_BASE_URL` to a URL the device can reach. An Android emulator commonly uses `http://10.0.2.2:3000`; a phone needs the computer's LAN address over a trusted network.
5. From `mobile/`, run `npm install`, then `npx expo start`.

Run `npm run verify` for typechecking, linting, and Android/iOS production JS bundles. This app intentionally does not target web. Camera, Keychain/Keystore, SQLite, and notification permission behavior still require a real iOS and Android device. Push notifications require an Expo development build, EAS project ID, platform credentials, and a server token-registration endpoint; none are created by this foundation.

## Implemented boundaries

- Secure login: short-lived bearer access token plus rotating, revocable refresh token. Refresh tokens are stored only in iOS Keychain / Android Keystore and only a SHA-256 hash is stored server-side.
- Server authority: `/api/mobile/auth/me` returns plan, trial, allergy, and dislike state. The client never grants Premium or computes offer eligibility.
- Camera: native barcode scan calls the real Open Food Facts-backed server service. Label, fridge, and pantry photos are captured locally; upload/extraction is intentionally blocked until the review-first mobile inventory endpoint is built.
- Shopping: SQLite caches full lists. Check/uncheck works offline using a last-write-wins queue and syncs on reconnection. Creating lists/items remains online-only and is not exposed in the first UI.
- Notifications: explicit opt-in local reminders work. Push token collection is intentionally disabled until secure registration and deletion endpoints exist.

## Before device beta or store submission

- Deploy the additive mobile API and database migration through the normal reviewed web release workflow.
- Confirm ownership of provisional bundle IDs `com.recipereborn.app`; create the EAS project and signing credentials.
- Add native pantry/label upload, AI extraction, correction/review, and confirmed inventory save.
- Add bearer-protected recipe, collection, meal-plan, generation/cancel/retry, and billing-management endpoints/screens. Reuse the existing safety and entitlement helpers; do not copy rules into the app.
- Add password reset/deep-link flows, push-token registration/deletion, account deletion, privacy-policy/terms screens, analytics consent if analytics is added, accessibility QA, device matrix QA, and store screenshots/listings.
- Complete Apple privacy nutrition labels and Google Play Data safety answers from `PRIVACY-DATA-INVENTORY.md`; have the final wording reviewed before submission.
