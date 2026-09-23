# Android build 10: recording lifecycle repair

Build 9 installed and retained the owner's QA session on a Samsung Note20 running
Android 13. Typed AI Chef messages succeeded. Both voice entry points appeared to
return to idle without an error despite microphone permission being granted.

A React reproduction showed that changing the navigation object while the screen
remains focused invokes `useFocusEffect` cleanup and cancels a new recording.
Build 10 subscribes to explicit focus/blur events and separates subscription
replacement from recording cancellation. Cancel, blur, background, and unmount
must still stop recording. The reproduction passes after this change, but the
physical-device cause and complete repair require the signed build 10 retest.

- Version: 1.0.0; Android version code: 10.
- Device profile: `preview-qa`; package: `com.recipereborn.app.qa`.
- Update the existing QA package with its original signing key; preserve its data.
- Do not update or clear the regular `com.recipereborn.app` package.

Run the full [device protocol](./ANDROID-CODE9-QA.md), particularly the editable
voice transcript in both screens and cancellation during startup/recording.
Finish the real photo, barcode, comparison, save, meal-plan, and shopping checks.
An isolated reproduction, build, or install is not a physical-device pass.

Before every automated phone input, verify that the QA app is still foreground.
Pause automation if the owner switches to another app; do not type into or capture
unrelated personal apps. Coordinate real speech and food photos with the owner.

No Play release is authorized by this QA build alone.
