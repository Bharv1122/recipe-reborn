# Android build 9: voice, photos, and package flow

This candidate contains the simplified package scan handoff, editable voice input,
fridge/pantry photos, package-versus-homemade comparisons, and the Android chat and
navigation fixes. Build 8 from September 7 does not contain the new native modules.

## Build identity

- App version: `1.0.0`; Android version code: `9`.
- Device-test profile: `preview-qa`; display name: **Recipe Reborn QA**.
- Device-test package: `com.recipereborn.app.qa`.
- Store profile: `play-internal`; package: `com.recipereborn.app`.
- API: `https://recipereborn.com`.
- EAS owner/project: `@reciperebornmobile/recipereborn`.

Use the separate QA package for the first physical-device pass. Do not uninstall or
clear the regular app's data. The two packages have separate local storage, but both
use the production API: use only the owner's authorized test account and disposable
test records. Never alter existing saved recipes, plans, or shopping lists.

## Focused device pass

1. Confirm package/version in the installed APK and open the app. Sign in; check
   navigation and keyboard spacing with the phone's existing display settings.
2. Scan a real package barcode. Review its ingredients directly, without selecting
   a redundant package-label mode. Generate one recipe. Verify the original and
   homemade additives, distinct nutrition serving bases, estimate labels, and
   unavailable values. Nutrition failure must leave the recipe usable.
3. Use voice in recipe creation and AI Chef. Speak a short ingredient list or
   question, stop, edit the transcript, then deliberately generate/send. Verify
   microphone denial preserves typing, cancel sends no text, and leaving the screen
   or backgrounding during recording stops it. Verify typed chat Send also works.
4. Photograph the fridge and pantry or choose saved pictures. Combine photos,
   review/edit the detected ingredients, remove an incorrect item, then continue.
   Verify denial/cancel and unreadable-photo recovery. Confirm original photos
   remain intact; only temporary upload copies may be removed.
5. Save the test recipe and reopen it. Add it to a new disposable plan and shopping
   list. Verify duplicate-add protection and check/uncheck behavior offline, then
   reconnect. Inspect crash logs after the pass.

The package comparison currently appears on the generated-result screen and is not
persisted after saving/reopening. Do not report saved-screen comparison as supported.

## Evidence and release gate

Record actual APK build ID, source commit, SHA-256, installed package/version,
device model, completed steps, failures, and any disposable records left behind.
Typechecking, linting, JS exports, and mocked API tests do not prove physical
microphone/camera behavior. A successful cloud build also does not prove device QA.

Only after the signed-device pass should the matching store AAB be built and a
closed-test update be considered. A QA APK is not a Play release. Do not advertise
these native features as delivered to testers until the release is verified.

References: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and
[app version management](https://docs.expo.dev/build-reference/app-versions/).
