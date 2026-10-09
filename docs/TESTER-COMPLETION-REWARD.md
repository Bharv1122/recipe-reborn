# Tester completion reward

Code: **TESTERTHANKS**. Two calendar months of Premium, starting at redemption,
after Beth confirms a completed 14-day test and feedback. Maximum 25 accounts;
one reward per account. No card, Stripe subscription, charge or auto-renewal.
The testing period is separate from the reward. Merely waiting 14 days, signing
up, or knowing the code never qualifies someone.

No tester is approved by this release. The existing PLAYTEST14 offer is unchanged.

## Approve a completed tester

Only after Beth confirms completion, an operator with the existing database access
runs the command below using the tester's Recipe Reborn account email, verified
test-start/completion timestamps and a reference to their feedback. Do not infer
Play opt-in from app signup or login. Do not put private feedback in the reference.
Load database credentials using the established private environment; never print them.

```text
npx tsx scripts/approve-tester-completion.ts --email <account-email> --started-at <ISO-timestamp> --completed-at <ISO-timestamp> --feedback-reference <record-reference> --beth-confirmed
```

The command validates 14 full days and records approval, but does not start Premium.
No public API accepts self-reported completion. Approval uses an account-bound
record in the existing VerificationToken table, separate from auth/password tokens.
Redemption records must be retained even after their expires timestamp: they prevent
repeat rewards and preserve the 25-account limit. No database migration is needed.

## Redeem

After approval, tester signs into https://recipereborn.com/pricing with the same
Recipe Reborn account used on Android, opens **Have a community code?**, enters
**TESTERTHANKS**, and applies it. Reopen Android to refresh the account. The reward
does not provide Google Play tester eligibility; that invitation remains separate.
Existing paid/permanent Premium access is protected; contact support for these cases.

Copy for invitations: “Complete the 14-day test and share honest feedback to receive
two free months of Premium after completion is confirmed. No purchase or positive
review is required.” This release does not send or publish invitations.
