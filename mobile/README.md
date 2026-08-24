# Recipe Reborn native foundation

Expo SDK 57 / React Native app for iOS and Android. This is a native client, not a WebView. The Next.js app remains the system of record for accounts, subscriptions, trials, allergies, recipe safety, and customer data.

## Run locally

Requirements: Node.js 22.13 or newer, npm, and the Recipe Reborn backend environment.

1. Apply the mobile refresh-token and push-token migrations to a non-production database.
2. Run the web API from the repository root: `npm run dev`.
3. Copy `.env.example` to `.env.local` in this folder.
4. Set `EXPO_PUBLIC_API_BASE_URL` to a URL the device can reach. An Android emulator commonly uses `http://10.0.2.2:3000`; a phone needs the computer's LAN address over a trusted network.
5. From `mobile/`, run `npm install`, then `npx expo start`.

Run `npm run verify` for typechecking, linting, and Android/iOS production JS bundles. This app intentionally does not target web. Camera, Keychain/Keystore, SQLite, password-reset links, and notification behavior still require real iOS and Android devices. Push delivery additionally requires an EAS project ID and platform credentials; the opt-in registration and deletion server boundary is implemented.

## Implemented boundaries

- Secure login: short-lived bearer access token plus rotating, revocable refresh token. Refresh tokens are stored only in iOS Keychain / Android Keystore and only a SHA-256 hash is stored server-side.
- Server authority: `/api/mobile/auth/me` returns plan, trial, allergy, and dislike state. The client never grants Premium or computes offer eligibility.
- Camera: native barcode scan calls the real Open Food Facts-backed server service. Fridge and pantry photos can be combined, extracted, corrected, and only then confirmed into the existing inventory. The server does not store source photos.
- Core product: recipe generation/cancel/save, saved recipe browsing, collections, meal plans, shopping lists, subscription status/portal, password reset, and account deletion use authenticated server boundaries.
- Shopping: SQLite caches full lists. Check/uncheck works offline using a last-write-wins queue and syncs on reconnection. List and item creation require a connection.
- Notifications: explicit opt-in local reminders work. Push registration is opt-in and refuses to run without a physical device and configured EAS project.

## Before device beta or store submission

- Confirm ownership of provisional bundle IDs `com.recipereborn.app`; create the EAS project and signing credentials.
- Add the Apple Team ID and Android signing SHA to the hosted universal-link association files, then verify reset links in signed builds.
- Complete physical-device accessibility, camera, offline, notification, password-reset, and account-deletion QA; capture final store screenshots from approved signed builds.
- Decide and implement the Apple/Google in-app purchase approach before exposing subscription purchase in store builds. Existing Stripe customers can manage billing through the verified web portal.
- Complete Apple privacy nutrition labels and Google Play Data safety answers from `PRIVACY-DATA-INVENTORY.md`; have the final wording reviewed before submission.
