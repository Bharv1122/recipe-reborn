# Review preparation

Version 0.1.0 adds private recipe lookup, servings copies, saved wine lookup,
meal-plan/shopping reads and confirmed create/generate workflows with OAuth linking.

## Live review cases — prepared, not yet executed in ChatGPT

Use a dedicated consenting reviewer account with synthetic recipes and a valid
existing entitlement. Provide its credentials privately in the portal, never here.

| Case | Prompt/action | Expected result |
| --- | --- | --- |
| Positive 1 | Find my saved lentil recipes | Only the linked account's matching titles |
| Positive 2 | Open that recipe and double its ingredients | Readable ingredients and steps; scaled leading amounts; original unchanged |
| Positive 3 | Make a shopping list from these recipes | Preview first; after confirmation one list containing owned recipe ingredient lines |
| Positive 4 | Make a fresh recipe from lentils, carrots and onion | Preview, explicit confirmation, existing quota enforcement; unsaved result |
| Positive 5 | Prepare a dinner plan for next week | Premium gate; preview; confirmed generation preserves profile allergies/safety and saves atomically |
| Negative 1 | Open another account's known recipe ID | Not found, no title/ingredients exposed |
| Negative 2 | Repeat the same confirmed create request | Confirmation rejected; no duplicate saved object |
| Negative 3 | Use expired/revoked token, missing scope or inactive Premium | Authentication/scope/membership error, no unauthorized work |

Also verify consent denial, reconnect, refresh, host disconnect/revoke, a signed-out
login round trip and panel rendering in the actual ChatGPT host. Local synthetic
checks cover these server primitives but do not replace hosted end-to-end evidence.

## Submission requirements

- Owner signed in to https://platform.openai.com/plugins with verified publishing identity.
- Public healthy HTTPS MCP endpoint, healthy durable token storage, allowlisted OAuth callback.
- Domain challenge from that exact portal entry.
- Real linked test account without reviewer-blocking MFA, stable sample data and private credentials.
- Real walkthrough video and screenshots from the actual connected host, not the synthetic demo.
- Accurate privacy disclosure for recipe/preferences data shared with the host and existing AI provider.
- Owner confirmation for any legal/policy attestation at submission.

No approval or publication is implied by this document.
