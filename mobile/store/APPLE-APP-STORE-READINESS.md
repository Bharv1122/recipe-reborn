# Apple App Store readiness

Assessment updated August 26, 2026. This file covers Apple only and does not authorize account creation, enrollment payment, signing, store-build uploads, App Store Connect changes, or submission.

## Locally ready

- Native Expo SDK 57 / React Native client; not a WebView.
- App name, version `1.0.0`, URL scheme, opaque 1024 x 1024 icon, camera/photo permission text, notification configuration, and provisional bundle ID `com.recipereborn.app`.
- Configured Expo owner/project and public EAS project ID; authenticated ownership is not verified locally.
- Draft App Store copy, privacy answers, privacy policy URL, support URL, and in-app account deletion.
- Version 1 is configured for iPhone only (`ios.supportsTablet: false`), avoiding iPad QA and screenshot requirements for this release.
- Expo SDK 57 is compatible with Xcode 26.4+ and Apple's current iOS 26 SDK upload requirement.

## Local verification completed August 26, 2026

- Expo configuration resolves `ios.supportsTablet: false` and bundle identifier `com.recipereborn.app`.
- Mobile TypeScript check passed.
- Mobile Expo lint passed.
- Expo Doctor passed all 21 checks after aligning SDK 57 patch versions.
- Local production iOS JavaScript export passed (1,248 modules; 2.7 MB Hermes bundle).
- Full Recipe Reborn web production build passed and includes `/support`.
- `git diff --check` passed. Line-ending notices are warnings only.
- Static accessibility hardening completed for screen-reader labels/roles, selected and checked states, live error/status announcements, password autofill semantics, decorative images, and 44-point interactive controls. Physical VoiceOver and Dynamic Type QA still requires a signed iPhone build.
- Static privacy/security review found no native analytics, crash-reporting, advertising, tracking, location, contacts, microphone, or health-data SDK. Mobile API routes require bearer authentication, validate request bodies, and scope user-owned records by authenticated user ID.
- Live URL check on August 26, 2026: privacy policy, terms, and account-deletion pages return HTTP 200. The planned support URL returns HTTP 404 until the already-prepared local `/support` page is explicitly approved for deployment.
- npm reports 11 moderate transitive advisories inside Expo configuration/build tooling. npm's offered automatic fix would downgrade Expo 57 to Expo 46, so it was not applied. Recheck after future compatible Expo patches; do not use `npm audit fix --force` blindly.

## Decisions or access required before signed iOS work

1. **Decided: enroll as an individual.** The App Store seller name will be the account holder's verified legal personal name. Apple currently charges USD 99 per membership year.
2. Confirm ownership of `com.recipereborn.app`, the Apple Team ID, and access to `@reciperebornmobile/recipereborn` in Expo.
3. **Decided: version 1 is iPhone-only.** Reconsider iPad support in a later release after dedicated iPad QA.
4. **Decided: version 1 honors existing Premium entitlements but contains no purchase or billing-management controls.** A later Apple in-app purchase implementation requires a separate decision and approval.
5. Confirm the export-compliance answer against the final signed binary before setting `ITSAppUsesNonExemptEncryption`. Current source appears limited to HTTPS, Apple Keychain/SecureStore, and standard platform cryptography, but Apple makes the account holder responsible for the determination.

## Next user-controlled enrollment step

The account holder should open [Apple Developer Program enrollment](https://developer.apple.com/programs/enroll/) and begin **individual** enrollment using the Apple Account that should permanently own Recipe Reborn. Before continuing, confirm that two-factor authentication is enabled and the Apple Account's first and last name exactly match the account holder's government-issued ID. Apple will request the legal name, email, phone number, and physical address; P.O. boxes are not accepted. Stop before accepting agreements or paying the USD 99 annual fee if any identity, seller-name, or ownership detail is wrong.

Codex must not create or sign in to this account, accept agreements, pay the fee, or complete enrollment without a new explicit instruction.

## Work after those decisions

1. Verify Expo ownership and Apple membership without creating or changing credentials unexpectedly.
2. Register the bundle ID, add the Team ID to the Apple site-association file, and verify Universal Links in a signed build.
3. Create an approved signed device/TestFlight build and test authentication, password reset, account deletion, camera/photo permissions, recipe safety, offline shopping, notifications, accessibility, and iPhone layouts. Use synthetic data and no live charge.
4. Run the local release gates: mobile typecheck/lint/iOS export, Expo Doctor, web production build, dependency audit, and synthetic API verification with cleanup.
5. Capture final screenshots only from the approved signed build, reconcile App Privacy answers with that binary and its third-party processing, and complete App Store metadata/reviewer notes.
6. Stop for explicit approval before uploading any build or submitting anything to App Review.

## Current blockers

- Individual seller type is decided. Apple Developer membership/enrollment completion, Team ID, bundle-ID ownership, App Store Connect record, and signing credentials are not confirmed locally.
- Universal Links cannot be finalized without the Team ID and a signed-device test.
- No signed iOS device QA, release build verification, screenshots, privacy-form reconciliation, upload, or submission has been completed.
- The App Store support URL cannot be used until `/support` is deployed and rechecked; deployment requires separate explicit approval.

## Remaining non-account work

- iPhone-only scope is complete in local configuration and release documentation.
- Premium billing/storefront policy is complete for version 1: existing entitlements only, with no purchase or management controls in the iPhone app.
- Complete the owner-controlled export-compliance determination for the final binary. No local flag was guessed during the static audit.
- After those decisions and separate approval: update local configuration/materials, run local verification, and prepare synthetic-data QA scripts and screenshot shot lists. None of these steps requires changing App Store Connect, but builds and any external verification still require separate approval.
