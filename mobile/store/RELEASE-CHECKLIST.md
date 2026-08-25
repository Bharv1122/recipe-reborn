# Device beta and store release checklist

## Owner actions required

- Confirm ownership of provisional iOS identifier `com.recipereborn.app`.
- Use native Android package `com.recipereborn.app` in a fresh Play draft. Leave the existing `com.recipereborn.app.twa` TWA listing untouched.
- Enroll in Apple Developer and create the Expo/EAS project without changing the production website. The existing Google Play account is already active.
- Add the EAS project ID and platform signing credentials.
- Supply Apple Team ID for Universal Links. Android's three currently verified Play package fingerprints are in the website association file; add any later EAS fingerprint that is not already listed.
- Decide the store-compliant in-app subscription purchase approach. Do not expose a Stripe purchase button in the store build without policy review.

## Signed-device verification

- Fresh signup, sign-in, refresh rotation, sign-out, password reset, and reset-link routing.
- Recipe generate, cancel, retry, save, browse, and delete with allergy and entitlement regression checks.
- Barcode lookup and camera permission denial/recovery.
- Multi-photo fridge/pantry extraction, correction, add/remove, explicit confirm, and saved-inventory reload.
- Collections and meal-plan add/remove flows.
- Shopping online creation and offline toggle/reconnect sync.
- Local notification and opt-in push registration/revocation.
- Subscription status and hosted management return path; no test or live charge from QA.
- Account deletion with and without an active subscription guard.
- VoiceOver/TalkBack, Dynamic Type/font scaling, contrast, small-screen layout, keyboard navigation, and slow/offline error states.
- Capture screenshots with synthetic data only after all device checks pass.

## Submission gate

Run `npm run verify` in `mobile/`, full web `npm run build`, production synthetic API verification with cleanup, dependency audit, and route-specific production log review. Reconcile store privacy forms with the final binary before submission.
