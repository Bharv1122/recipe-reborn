# Recipe editing backup review — October 3, 2026

Beth requested a two-way critical review with Claude. Actual Claude Code CLI
reviews were used; these were code reviews, not independent production tests.

## Findings and disagreements

- Claude showed that successful OpenAI import was followed by Gemini-only edit
  requests, including the Android cups-and-spoons action. This patch adds the
  same bounded backup to those edits, preserving existing validators.
- Claude found that provider failure became a content-repair prompt. Provider
  failures now stop editing with a service error instead of another edit attempt.
- Codex rejected invalidating the real Gemini key as a test strategy. Claude
  withdrew the proposal. Mocked outages and a separately forced backup test are
  different evidence; production auto success does not prove an actual outage.
- Codex challenged treating faithful metric imports as defects. Measurements
  remain unchanged until the user requests conversion. Claude agreed.
- Codex challenged a blanket ban on another call after any OpenAI answer.
  A completed but invalid recipe may receive one content repair; transport
  failure and refusal may not. Claude revised his recommendation.
- Claude caught unknown network/body errors still entering content repair, and
  a race between equal transport and request deadlines. Both were corrected:
  transport/envelope failures have their own boundary, and the outer deadline
  expires first. Added tests cover those cases.
- Upstream 400 does not trigger paid fallback. It returns a service error rather
  than a false claim that the photo is blurry. A corrupt/encrypted file can still
  require a different source; upstream responses are not shown to the user.

## Verification and limits

`npm run verify:recipe-edit-backup` exercises the actual routes, transport and
validators with synthetic auth/storage and intercepted network calls. Its 30
cases include provider outages, quota failure, explicit no-write behavior,
allergy rejection, content repair, refusal, cancellation and shared deadlines.
These tests do not prove live provider access or Android usability.

This patch does not migrate AI Chef, voice, nutrition or saved-plan meal
replacement. Physical phone acceptance remains separate from server tests.

