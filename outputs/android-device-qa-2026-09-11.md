# Recipe Reborn Android device QA

Device: Samsung Note20 SM-N981U1. Installed app: com.recipereborn.app, 1.0.0 (version code 8), last updated September 9, 2026. Testing performed September 11, local time.

## Verified on the installed build

- App opens and remains foreground; crash buffer was empty at initial launch verification.
- Existing saved recipes load, and recipe ingredients and instructions open.
- Recipe-to-meal-plan picker loads existing plans and day/meal choices. Existing plans were not modified.
- Shopping screen loads existing lists and items. Add/check-off/offline synchronization remain untested.
- Barcode scanner screen opens. Recognition requires a real target and remains untested.
- Package-label text input generates Homemade Raisin and Cinnamon Oatmeal from rolled oats, raisins, cinnamon, salt. Saving succeeds; recipe appears in saved list and reopens with instructions. This new test recipe remains saved.
- AI Chef starter prompt "Help me fix this dish" receives an answer. The test conversation remains on the phone.

## Failures and local fixes

- Typed-message Send did not submit after repeated taps. Source passes the native press event to send(suggestion?: string), which calls trim on the argument. Changed to an explicit no-argument callback. Starter prompts already supply strings and worked on the installed build.
- Home bottom tabs overlap the Android system navigation bar, confirmed by outputs/rr-qa-home.png. The device has an existing 1080x1920 display override (physical 1080x2400), left unchanged. Updated tab height and bottom padding to include the safe-area bottom inset.

TypeScript, lint, diff whitespace checks, and Android export passed (1,387 modules; 3.1 MB Hermes bundle). These source fixes are not installed on the phone; a rebuilt app and device retest are required.

## Remaining release QA

Camera label/barcode recognition; end-to-end add-to-plan and shopping-list creation; duplicate-add protection; shopping writes/offline synchronization; sign-out/sign-in and recovery; fixes on a new signed build. No store submission or release was performed.

