# Recipe Reborn — existing Play submission access

Checked September 23, 2026 (local), using the already installed EAS CLI 23.2.0 and authenticated Recipe Reborn project. No build, upload, submission, credential change, or private-key download was performed.

**The existing EAS setup provides a submission route without Play Console UI.** The production package has a remotely assigned Google service account, and the most recent recorded submission through EAS succeeded. Current Play permission validity and current store-review state were not independently exercised by this read-only check.

## Existing credentials

Ran `eas credentials -p android`, selected the existing `play-internal` profile, inspected its read-only summary, then selected **Exit**. No management action was selected.

- Project: `recipereborn` under `reciperebornmobile`.
- EAS project ID: `56cc462a-d0a6-4cc7-8ca8-907bcb76f2fd`.
- Application identifier: `com.recipereborn.app`.
- Google service account for Play submissions: assigned.
- Account: `recipe-reborn-eas-submit@nifty-realm-454921-k4.iam.gserviceaccount.com`.
- Google project: `nifty-realm-454921-k4`.
- Credentials summary reported updated 16 days ago.
- Existing default Android signing keystore: present, type JKS.

Only credential metadata was inspected. No service-account JSON, private key, key password, or keystore was printed or downloaded.

## Submission evidence

`submission-history.json` contains a fresh, selected-field response from the read-only command `eas submit:list -p android --limit 20 --json --non-interactive`. Signed log URLs were excluded from the saved evidence.

Latest submission `34c03506-30ce-48c1-8ccc-01fb800562da` finished successfully on **2026-09-07 at 18:46:38 UTC**. It submitted AAB build `1d70ab02-5d26-4493-8e19-0e9d522da2eb`, production package `com.recipereborn.app`, version `1.0.0`, version code **8**, profile `play-internal`, to **alpha** with release status **COMPLETED**.

An earlier same-day attempt reported missing service-account permissions; the later successful submission is the newest record. This demonstrates that the earlier failure was followed by a working submission, without proving permissions cannot have changed since.

## Next tested production AAB

The current `submit.play-alpha.android` profile in `mobile/eas.json` specifies `track: alpha` and `releaseStatus: completed`. It has no local `serviceAccountKeyPath`. Installed CLI source confirms that this configuration resolves the assigned EAS service-account credential and passes its remote ID to EAS Submit. A local private-key file is not required.

When a new **tested production-package AAB** is approved for submission, the existing command is:

```text
eas submit -p android --profile play-alpha --id <TESTED_PRODUCTION_AAB_BUILD_ID> --non-interactive --wait
```

This command was **not run**. Use an explicit verified AAB build ID; the current `com.recipereborn.app.qa` APK is a separate QA application and is not the production Play artifact. Confirm the production application ID, signing setup, and unused higher version code on the chosen build before submission. `play-internal` names the build profile; the submit profile shown above actually targets **alpha**, not the internal test track.

## Exact remaining limits

- No new tested production AAB was submitted by this task.
- EAS CLI's Android `submit:status` explicitly says Google Play app status is unavailable; it directs users to submission history. EAS FINISHED does not independently prove current Play approval, tester access, or store availability.
- This read-only check did not validate current service-account permissions against Google. A future submission could still fail if those permissions were changed, the key was revoked, or Play requires a new Console action.
- No further credential setup is currently indicated by EAS metadata. If the next actual submission reports a Google permission or policy requirement, that exact error determines whether Console access is required.
