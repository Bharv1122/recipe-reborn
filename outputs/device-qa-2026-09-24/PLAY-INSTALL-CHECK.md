# Recipe Reborn Google Play device check — September 24, 2026

Connected Samsung SM-N981U1 (Note20), authorized ADB, screen unlocked.

- No Recipe Reborn production/QA package or Cheffo package was installed at the initial check.
- Opened Recipe Reborn official Google Play listing. Installed the offered early-access package; initial package was versionCode8, installer com.android.vending.
- Live Play Console confirmed Alpha build15 active, 100% rollout, 18,747 supported devices; old build8 deactivated.
- Restarted only the Google Play Store app without clearing data. Refreshed official listing exposed Update and current release notes.
- Applied Update through Google Play. Package com.recipereborn.app now versionCode15/versionName1.0.0, targetSdk36, installerPackageName com.android.vending.
- Opened installed app: native MainActivity and complete sign-in screen displayed.
- Asked owner to sign in on device. Authentication, voice/photo, recipe save/reopen, meal-plan/shopping, offline and crash checks remain pending on this actual Play-installed build.
- No app data cleared, existing user records changed, or sideload used. The successful installation is not a full device QA pass.

## Signed-in feature checks
- Owner signed in successfully. Native Home and Account loaded; no credentials were handled by automation.
- Voice: owner spoke eggs/spinach/cheese and confirmed success. UI independently showed `Eggs, spinach, cheese` and ready-to-review notice.
- Generated Cheesy Spinach Frittata: 15 minutes prep, 25 minutes cook, 2-3 servings. Saved successfully. Generated and saved views both show 320 kcal, protein20g, carbs5g, fat24g, fiber2g, sodium350mg with estimated/per-serving labels.
- AI Chef: actual typed question about preventing a frittata sticking received a complete cooking response with reporting control. This created one test chat exchange.
- Existing meal plans loaded. Started generation of a NEW plan for week2026-09-21,21meals,2servings. Outcome pending. No existing recipe/plan/list edited.
- Test-created saved recipe remains in owner's account. Final camera/barcode, new shopping list/offline synchronization, plan completion and crash checks remain pending.

## Completed on the Play-installed build15
- New weekly generation succeeded: Meal Plan - Week of9/21/2026 contains21meals. Returned to list, verified21 count, reopened the plan and opened its Monday breakfast recipe.
- Shopping handoff preserved six meal ingredients. Created isolated list QA-Play15-Sept24 and added all six successfully; existing shopping lists were not edited.
- Offline check: preserved original WiFi/mobile-data settings (both enabled), briefly disabled both, checked4largeeggs on the NEW list, saw checked=true plus offline/sync message. Both radios restored in a finally block and verified enabled. Reopened Shopping online: offline banner cleared, six items loaded and eggs remained checked after refresh, sorted to bottom. Sent an online untick afterward.
- Current Recipe Reborn process emitted no AndroidRuntime/ReactNativeJS error entries in the scoped logcat check. This is a scoped check, not proof every crash path is covered.
- Opened Use my ingredients and asked owner to take a real food photo; awaiting result. Barcode and voice-cancellation/denial edge cases are not yet checked on build15.
- Test artifacts left in owner account: Cheesy Spinach Frittata, new21-meal weekly plan and its recipes, QA-Play15-Sept24 list, and one AI Chef exchange. No existing saved content was deleted or edited.

## Pantry ingredient-list defect found during camera check
- Owner confirmed the real food photo was correctly listed. The subsequent generated recipe listed only oil/onion/garlic while its instructions used canned chili, carrots, green beans, broth, cooking wine and toppings. Screenshot plus `11-ingredient-mismatch.xml` establish the mismatch; this is not a passing end-to-end camera-to-recipe result.
- Mobile and website rendering/save paths preserve the full server array. The server accepted an incomplete model ingredient list. Commit ac218a4 adds pantry ingredient reconciliation before completion/allowance charge, complete-list prompt requirements, and ingredient/step validation. Pantry dietary requests now keep the pantry-specific prompt.
- 27 actual-handler regressions and32 helper checks passed, plus scoped lint, production build and independent review. A real-provider replay of the screenshot recipe expanded3 original entries to17 complete ingredients in6.9 seconds.
- Production deployment dpl_F1FjK3dCXnR9N78xMEaR6YBLVHaE is READY and aliased to recipereborn.com at ac218a4be57cc653d91a93fdaa7dab7d6b77182d. A disposable real website session generated the pantry chili with11 ingredients, checked every mentioned fixture food against the list, and saved/reopened exact ingredients and instructions. Exactly one allowance was charged. Finished in19.9 seconds; synthetic account/recipe deletion independently verified. Evidence: outputs/releases/pantry-completeness-production.log.
- The server fix does not require a new Android binary. Previously generated recipes are not rewritten automatically. Fresh post-fix visual verification on the physical phone remains to be done; its current foreground was NotificationShade, so no further phone inputs were sent.
