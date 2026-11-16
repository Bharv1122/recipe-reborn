# Recipe Reborn Android update — September 23, 2026

**Build 15 has been submitted to Google Play's existing closed Alpha test.** Publishing overview shows **Changes in review**, with automated checks complete and Google review pending. Tester availability and public production release are not yet confirmed.

- Release: `15 (1.0.0) - Android testing`, release4, 100% of the existing closed Alpha track.
- Code14 was removed from the draft; it remains in the artifact library.
- The age-confirmation checkbox is included, and signup sends the required confirmation. The reported screenshot lacks this current UI. Until Google approves the update, create an account at https://recipereborn.com/signup, confirm your own age, then sign in through Android.
- Voice/camera repairs, saved nutrition, offline shopping synchronization and content reporting are included. Physical checks cover earlier QA builds through14; build15's compiled JavaScript is byte-identical14.
- Final bundle package/version/API levels, upload signature and optional microphone were verified. Play confirms zero supported devices lost compared with live code8; the six-device compatibility warning is resolved.
- The sole remaining warning concerns a deobfuscation file. Actual build15 uses D8 without R8 obfuscation, so no mapping file applies.
- Updated Data Safety is already published. Live privacy, account-deletion and support pages were checked.
- Existing reviewer access was preserved. The account has active Premium with no recorded expiry. Credential values are hidden by the browser; no reset or new account was necessary. A fresh password sign-in was not performed.
- Opus 5.5 review is deferred as requested. Local and Hermes checks passed.
- One build used $1 of included Expo credits; $22 remain, zero overage. No purchase or Claude upgrade.

[Google Play publishing status](https://play.google.com/console/u/0/developers/6418142518539719933/app/4975390055276517153/publishing)

Machine-readable evidence: `code-15-release-status.json`; signed-bundle details: `../releases/android-code-15-artifact-handoff.json`.

