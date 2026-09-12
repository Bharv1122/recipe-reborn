# Recipe Reborn: voice, pantry photos and comparison QA

## Delivered in local source

- Tap to speak ingredients, a dish request, or an AI Chef question. Transcribed words append to the existing text; generating/sending requires a separate user action. No wake-word listener, background recording, or spoken AI replies are implemented.
- Voice requests use the existing transcription provider through authenticated native uploads. Microphone denial, empty speech, service errors and cancellation leave typing available. A recording is limited to one minute; leaving the screen or backgrounding the app cancels it. Preparation and cleanup finish before another recording can start.
- Fridge/pantry input offers the device camera and saved pictures. Up to four photos become one reviewable ingredient list. Names are editable; uncertain items are marked. Quantity/location editing and inventory saving are optional controls. A failed recognition can recover through manual entry or another photo.
- Photo upload copies are resized and converted to JPEG, bounded to 900 KB each and removed after the request. Original photos are not deleted. Authenticated multipart uploads use Expo's File-compatible fetch implementation, retaining token refresh and cancellation signals.
- Barcode/label nutrition travels with the package ingredients. The generated result shows additive matches in both original and actual homemade ingredients, plus a nutrition table with source/serving bases. Homemade values are estimates; missing values stay unavailable. OCR values are withheld until confirmed. Nutrition failure leaves the recipe usable and offers retry.
- The account page gives past-due subscribers a clear payment-method action using the existing billing portal. No payment or subscription was changed.

## Automated checks

`node scripts/verify-nutrition-comparison.cjs` passes against actual bundled source with mocked auth/provider/native dependencies. It checks additive deduplication, sodium units, missing nutrients, the one-use package handoff, auth/rate/validation gates, M4A container recognition, transcript response, native multipart refresh/retry, and photo size fallback/temporary-file cleanup. It makes no live AI, microphone, camera or database calls.

The web production build passes. Mobile TypeScript, Expo lint, Android export and iOS export pass. Expo config introspection includes Android RECORD_AUDIO and the intended iOS microphone explanation, with no background audio mode requested. These are source/bundle/config checks, not signed native compilation or physical recording tests.

## Browser checks

The local preview uses actual React Native screens through React Native Web. Camera, recorder, account, AI and data services are explicitly simulated; sample recipes are always oatmeal. It must not be presented as a live product demonstration.

Verified:

- Package scan → ingredient review → generated comparison, without choosing a redundant package-label mode.
- Additives displayed as two original matches and zero actual recipe matches in the sample. Package and homemade nutrient bases remain distinct.
- Nutrition failure → recipe still available → retry returns the table.
- Missing package nutrition leaves package values unavailable while showing the homemade estimate.
- Unconfirmed OCR nutrients are hidden. Confirmed decimal edits survive; clearing a field with the keyboard displays an em dash rather than zero.
- Spoken words populate an editable input without generation. AI Chef preserves existing typed words, waits for Send and shows the simulated response.
- Microphone denial restores typing. Canceling preparation restores idle; canceling a pending transcription preserves existing text.
- Fridge and pantry camera paths produce a single editable list. An edited ingredient is carried into generation. No-results recognition permits manual entry and continuation.
- Camera denial keeps saved-photo selection usable. Optional pantry actions stay collapsed, and the ingredient list opens at the top after extraction.
- Comparison layout visually inspected at a 430-pixel content width. No browser console errors observed in the checked flows.

Preview sources: `outputs/flow-preview/`; run `node outputs/flow-preview/build.mjs` and `node outputs/flow-preview/server.cjs`, then open http://127.0.0.1:4179/. `comparison.png` is a sample-data screenshot. Query scenarios include `nutrition-error`, `review`, `no-nutrition`, `voice-denied`, `voice-empty`, `voice-error`, `voice-cancel-start`, `voice-cancel-upload`, `camera-denied`, `photo-cancel` and `photo-empty`.

## Release work still required

Create and install a new signed native build containing expo-audio and expo-image-manipulator. The previously installed APK cannot gain these modules by replacing its JavaScript bundle. Release the matching server changes through the normal deployment process, then verify real microphone permissions/recording/transcription, background/back cancellation, camera/large-photo uploads and account-specific results on the phone. iOS also needs physical-device coverage.

The comparison currently exists on the generated-result screen and is not persisted after saving/leaving that screen. No new phone installation, backend deployment, store upload, buyer outreach, paid listing, or production data mutation occurred in this work.
