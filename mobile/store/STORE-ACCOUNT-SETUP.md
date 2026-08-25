# Recipe Reborn store account and device-beta setup

Checked August 24, 2026. This document deliberately stops before account creation, paid enrollment, legal agreements, signing-key creation, app-record creation, or submission.

## Confirmed in the project

- Expo owner/project: `@reciperebornmobile/recipereborn`
- EAS project ID: `56cc462a-d0a6-4cc7-8ca8-907bcb76f2fd`
- URL scheme: `recipereborn`
- Provisional iOS bundle identifier: `com.recipereborn.app`
- Native Android package: `com.recipereborn.app`
- Android version code: `1`
- Production API and universal-link host: `https://recipereborn.com`
- Camera, photo library, barcode, notifications, secure storage, SQLite, and deep-link configuration
- Development-client, internal-preview, iOS-simulator, and production EAS build profiles
- Store listing, privacy/data-use, reviewer, accessibility, and release-checklist drafts in this directory

The iOS identifier remains provisional until confirmed in Apple Developer. The native Android app intentionally uses a new package and a new Play draft. The existing `com.recipereborn.app.twa` web-wrapper listing must remain untouched.

The connected Play Console was verified on August 24, 2026: it is an existing Personal developer account with verified contact details. A new native `com.recipereborn.app` record now exists as a draft with zero installed users. It is registered for Android developer verification with three verified certificate fingerprints. The old `com.recipereborn.app.twa` fallback remains untouched in closed testing and has never reached production. Expo SDK 57 targets SDK 36 by default for the native app.

## Not present or not confirmable locally

- An authenticated Expo/EAS session or linked EAS project ID
- Apple Developer Program membership, Team ID, App Store Connect app record, or iOS signing credentials
- EAS signing credentials and the final Play App Signing/upload-key handoff for the native release artifact
- Apple `apple-app-site-association` Team ID
- Development-client signing-certificate SHA-256 values, which can be added to `assetlinks.json` after those builds create their credentials. The current EAS preview certificate is already included.

No signing keys, service-account files, App Store Connect API keys, Google service files, or credential JSON files are committed to the repository. Keep all such secrets out of Git.

## Shortest safe owner sequence

Run these commands from `C:\Users\bethh\Documents\recipe-reborn\mobile`.

1. Create or sign in to a free Expo account, then authenticate this computer:

   ```powershell
   npx eas-cli@latest login
   npx eas-cli@latest whoami
   ```

2. Link a new or existing EAS project only after confirming the Expo account/organization that should own Recipe Reborn:

   ```powershell
   npx eas-cli@latest init
   npx eas-cli@latest project:info
   ```

   Keep the public EAS project ID that `eas init` adds. It is an identifier, not a secret. Do not put passwords, tokens, signing keys, `.p8` files, or service-account JSON in `.env` or Git.

3. Make the first Android physical-device preview. This produces an installable APK and does not submit to Google Play:

   ```powershell
   npx eas-cli@latest build --platform android --profile preview
   ```

   This build uploads the project to EAS and may create persistent remote signing credentials. Obtain action-time approval before starting it.

4. Create a Play-ready AAB for the private/internal Google Play track without submitting it:

   ```powershell
   npx eas-cli@latest build --platform android --profile play-internal
   ```

   The `play-internal` profile is store-distribution only; it has no auto-submit setting. Obtain action-time approval before EAS uploads source or creates signing credentials, and stop again before uploading the resulting AAB to Play Console.

5. For live-reload development on Android, build the installed development client once, then start Metro:

   ```powershell
   npx eas-cli@latest build --platform android --profile development
   npx expo start --dev-client
   ```

6. For a physical iPhone build, first complete Apple Developer Program enrollment, confirm the Team ID, and register the test device. EAS can then create an ad hoc profile with owner approval:

   ```powershell
   npx eas-cli@latest device:create
   npx eas-cli@latest build --platform ios --profile preview
   ```

7. A local iOS simulator build is available on a Mac without registering a physical device:

   ```powershell
   npx eas-cli@latest build --platform ios --profile development-simulator
   ```

8. After device QA, policy decisions, privacy-form reconciliation, and signing are complete, create store artifacts. This command builds but does not submit:

   ```powershell
   npx eas-cli@latest build --platform all --profile production
   ```

Do not run `eas submit` until the owner explicitly approves submission and all release gates pass.

## Store-account decisions the owner must make

- Apple individual versus organization enrollment. Organization enrollment requires the legal entity details and D-U-N-S information. An individual account displays the legal personal name as the seller.
- The existing Google Play account is Personal. Have counsel confirm whether it should remain individually owned or later be transferred to a properly formed business; do not create a duplicate developer account.
- Confirm `com.recipereborn.app` for iOS before creating the Apple app record. Android also uses `com.recipereborn.app` in a new native Play draft; leave the old `.twa` app untouched.
- Choose the store-compliant Premium purchase path before submission. Existing web Stripe billing must not be exposed as an in-app purchase shortcut without a current policy review.

## Values needed to finish verified links

- Apple: Team ID plus bundle identifier for `/.well-known/apple-app-site-association`
- Android Play/verification keys: configured at `/.well-known/assetlinks.json` for `com.recipereborn.app` using all three fingerprints shown as verified in Play Console on August 24, 2026.
- Android EAS preview builds: the current Expo preview keystore fingerprint is also configured. Add future development-build fingerprints only if those builds use a different certificate.

Android's website-side association is configured. It still requires live HTTPS verification and a signed-device test. Until Apple's association file is generated, iOS password reset can use the custom `recipereborn://` scheme, but verified iOS Universal Links are not release-ready.

## Pre-submission verification

Run:

```powershell
npm run verify
npx expo-doctor
npx expo export --platform android --output-dir dist-android
npx expo export --platform ios --output-dir dist-ios
```

Then complete every signed-device check in `RELEASE-CHECKLIST.md` with synthetic data. Never use customer accounts or make a real charge during QA.
