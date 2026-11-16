# Recipe Reborn code14: exact Play submission handoff

Updated September 23, 2026. The authorized code14 alpha draft upload FINISHED at
2026-09-24T04:07:06.318Z. Its launch explicitly requested changesNotSentForReview:true.
Root subsequently observed a separate Data Safety item in Google's "Changes in
review" section; this is distinct from code14's DRAFT release disposition.
No new build, credential change, browser action or device action by this worker.

## Verified candidate

- Production AAB: `C:\Users\bethh\Documents\recipe-reborn\outputs\builds\recipe-reborn-play-code-14-0e094cc.aab`.
- EAS build ID: `bc75c794-1646-4a98-85b7-38c2073fd009`, FINISHED.
- Source: `0e094ccc0af6dfa4992528480ce726d24b7f6308`.
- Actual binary: `com.recipereborn.app`, version `1.0.0`, versionCode14, targetSdk36.
- Size: 92,744,948 bytes. SHA256 freshly recomputed and matched:
  `B7E837B4CCF0DE6C913886400EB37A66B8EA7A6F6E480184877C665183C0B575`.
- Existing signature verification passed; production certificate SHA256:
  `A677D21D43928756EA8BD98972E9CFEDC477BB673137365342D1D34863AC11F9`.
  It matches the previous production candidate's certificate.
- Evidence: `outputs/releases/android-code-14-artifact-handoff.json` and
  `outputs/releases/android-code-14-play-artifact-verification.json`.
- QA APK `com.recipereborn.app.qa` is separate and must not be uploaded as this
  Play release. Codes12/13 are superseded.

## Exact draft-only command — executed once

Submission ID: `d9a9464e-5460-4602-84b9-0e59f612b34b`. Final status FINISHED is recorded in `code-14-draft-submission.json`. The exact production code14 and alpha/DRAFT are confirmed; no error. Do not repeat this upload.

Run from `C:\Users\bethh\Documents\recipe-reborn\mobile` using the existing installed CLI and remote Google service account:

```powershell
node 'C:\Users\bethh\AppData\Local\npm-cache\_npx\6bc7bae5c2059953\node_modules\eas-cli\bin\run' submit --platform android --profile play-alpha-draft --id bc75c794-1646-4a98-85b7-38c2073fd009 --non-interactive --no-wait
```

The new separate profile pins applicationId to `com.recipereborn.app`, track to `alpha`, releaseStatus to `draft`, and changesNotSentForReview to `true`. Installed-schema validation passed; the launch summary explicitly confirms all three release settings. The read-only API confirms alpha/DRAFT and the exact code14 build. Its installed query omits the review boolean, so the submitted profile and launch summary are that field's evidence. The existing `play-alpha` profile remains unchanged and was **not used**.

`play-internal` is the build profile name, not the submission track. No new build, purchase or credential change was made. The submission requested draft status and review disabled; separate Console state is documented below. [Expo submission configuration](https://docs.expo.dev/eas/json/#android-specific-options-1).

## Existing access and remaining gates

1. **Physical acceptance:** root verified QA14 Send with active default network:none. Exact friendly message appeared, note `QA-CODE14-OFFLINE-UNLOCKED` remained, and no false success appeared. Connectivity was restored and the draft cancelled. Screenshot/XML111 and112 plus independent XML assertions are recorded in `outputs/releases/android-code-14-device-reporting-verification.json`. This is a focused regression, not a full-app acceptance claim.
2. **Existing EAS/Google access:** September23's read-only credential inspection
   found a remote Google service account assigned to production
   `com.recipereborn.app`. Code14 subsequently uploaded successfully with that
   existing credential; no new key was provisioned. Evidence:
   `code-14-draft-submission.json`, `READINESS.md` and historical `submission-history.json`.
3. **Identity/version:** the finished submission confirms project
   `56cc462a-d0a6-4cc7-8ca8-907bcb76f2fd`, production package and versionCode14.
   Root owns direct Console verification of its exact alpha draft.
4. **Console/privacy/reviewer:** root owns the existing saved Data Safety changes,
   Publishing overview, current app-access instructions and permanent entitled
   reviewer account. Preserve the protected password; the reviewer makes their
   own required age confirmation. Reconcile saved declarations with code14,
   including optional audio/photo/chat/reporting and retention. No new Google
   review or tester availability is claimed here.
5. **Hosting decision:** both apps remain on a commercial-use-incompatible Hobby
   team in the last confirmed state. The owner still owns the commercial-hosting
   and pending training-setting decisions. This task authorizes no purchase.
6. **After submission:** the EAS submission ID is captured above; inspect Play's exact
   package/code14/alpha release, release warnings and review status. Handle the
   saved policy changes in Publishing overview as required by the actual Console
   state. Verify tester access separately. Existing production-access gating
   (2 opted-in testers against the stated12-for-14-days requirement) is separate
   from updating the current closed test.

EAS requires an existing Play app, authenticated Expo access and a Google
service-account credential. Those are represented by existing evidence, not
newly provisioned here. [Expo Android prerequisites](https://docs.expo.dev/submit/android/).

## Draft English release notes

The installed Android submit schema has no release-notes field, and
`--what-to-test` is iOS-only. Add or verify this text in the Play release editor;
the command above does not supply it. Draft text is also saved separately in
`code-14-release-notes-en-US.txt`.

> Speak ingredients or scan pantry and food-label photos. Saved recipes retain nutrition comparisons. Shopping check-offs work offline and sync after reconnecting. Report a generated recipe, saved recipe or individual AI Chef reply directly in the app. Clear connection messages keep reporting drafts available for retry. Includes account recovery, deletion-cleanup and privacy improvements. New accounts confirm they are 18 or older.


**Separate Console state:** Root refreshed Recipe Publishing overview after the upload and observed Changes in review containing only Data safety / Complete Data safety questionnaire, with no app-release row. Root performed no Send for review click. This separate review state must not be conflated with code14 release status DRAFT. Actual EAS worker logs show Fastlane received `--changes_not_sent_for_review true` and `--release_status draft`; both appear in its runtime settings. No review-related fallback/error appears in the retained relevant lines. `rescue_changes_not_sent_for_review:true` is a Fastlane default, and `track_promote_release_status:completed` is an unused promotion default: no promotion target was passed. These logs do not establish why the separate Data Safety change entered review. See `outputs/play-submission-readiness/code-14-draft-submit-log-evidence.json`.
