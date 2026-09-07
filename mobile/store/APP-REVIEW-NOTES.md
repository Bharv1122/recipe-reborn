# Apple App Review notes draft

Complete the bracketed items only after the signed build and synthetic reviewer account are ready. Do not include a personal password or customer account.

## Contact

- First name: [required]
- Last name: [required]
- Phone: [required]
- Email: [required]

## Reviewer sign-in

- Username: [dedicated synthetic reviewer account]
- Password: [provide only in App Store Connect]

## Notes for review

Recipe Reborn is a native iPhone app that helps people turn ingredient lists and reviewed pantry contents into recipe ideas. The app requires an account because recipes, collections, meal plans, shopping lists, pantry inventory, safety preferences, and subscription entitlements sync with the Recipe Reborn service.

Suggested review path:

1. Sign in with the dedicated reviewer account.
2. Open Scan and test barcode or camera permission handling. A photo can also be selected from the photo library.
3. Review and correct the extracted pantry draft before confirming it.
4. Generate and save a recipe, then open Saved Recipes, Collections, Meal Plans, and Shopping.
5. In Shopping, check an item while offline and reconnect to test synchronization.
6. Open Account to review subscription status, notification controls, Privacy Policy, Terms, password reset, and in-app account deletion.

Version 1 does not sell Premium or provide external billing-management buttons in the iPhone app. Existing Premium entitlements are read from the Recipe Reborn server and honored after sign-in.

The app does not store submitted source pantry/fridge photos. Users review extracted ingredient text before saving it. AI-generated recipes may contain mistakes, so the app tells users to review ingredients, allergens, preparation, and food safety before cooking.

## Items to finalize before submission

- Confirm whether push notifications are enabled in the submitted binary and provide any necessary test instructions.
- Provide any feature flags or steps needed to reach gated functionality.
- Verify every statement above against the exact submitted binary.
