# OpenAI backup rollout

Scope: authenticated recipe generation (including its reconciliation calls),
weekly meal-plan generation/repair, label photos, and text/image/PDF recipe imports.
Voice, guest routes, recipe adaptation, AI Chef, nutrition and other tools retain
their existing Gemini transport. This is a server change; QA28 can exercise it.

## Configuration

- `AI_PROVIDER=gemini` or unset: existing Gemini behavior.
- `AI_PROVIDER=auto`: Gemini first, then one OpenAI attempt on 403, 429, 5xx,
  connection failure. No provider change after a
  stream begins, a safety refusal, cancellation, or the overall deadline.
- `AI_PROVIDER=openai`: use OpenAI directly on the scoped routes for acceptance.
- `OPENAI_API_KEY`: dedicated server-only secret, chat-completions permission.
  Never copy a key from another application or expose it through NEXT_PUBLIC.
- Model: `gpt-4.1-mini-2025-04-14`, pinned; `store: false`.

Use an expiring, restricted key and rotate it before expiration. An expired
backup key must not be described as a working fallback. Billing configuration
and purchasing credit are separate from this code change.

Neither streaming nor non-streaming requests switch merely for being slow.
Timeout fallback is deliberately disabled until real latency is measured. General calls have a
45-second total cap; generation uses its existing deadline, and meal plans allow
up to 120 seconds per call within their 250-second generation deadline. Shorter
caller cancellation/deadlines always win. Response bodies share those limits.
Caller transport retries stop after OpenAI has been attempted; validation repair
is still a separate, bounded generation step. Images use chat image parts;
PDFs are sent inline, requiring no Files/Responses permissions. HEIC/HEIF cannot
fall back to OpenAI and need JPEG/PNG/WebP. Native audio is deliberately excluded.

The meal-plan strict array schema is wrapped in `{days: [...]}` for OpenAI and
unwrapped before the existing parser/food validators. Prompts and quotas are
unchanged. No saved recipe or plan is created merely by switching provider.

## Cost estimate

Official model pricing: $0.40 per million input tokens and $1.60 per million
output tokens. Approximate planning amounts, not measured live costs:

| Operation | Assumed input/output tokens | One successful request |
| --- | --- | --- |
| Recipe | 4,000 / 3,000 | $0.0064 |
| Weekly plan | 6,000 / 12,000 | $0.0216 |
| Photo import | 4,000 (including image) / 3,000 | $0.0064 |

Recipe reconciliation, safety repairs, PDFs with many pages and failed/retried
requests can add cost. Image token count depends on dimensions. Existing Gemini
attempts can also be billed before fallback. These figures do not imply unlimited
requests from a $5 credit purchase.

Sources:
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/docs/guides/file-inputs
- https://developers.openai.com/api/docs/guides/your-data

## Acceptance and rollback

Run `scripts/verify-ai-fallback.ts`, existing meal-plan generation, extraction
recovery/import, native and generation safety checks, TypeScript and production
build. Mocked checks do not verify real model access, billing, latency or OCR.

Before `auto` is activated, perform live disposable-account acceptance under
`openai`: generated recipe, full 21-meal preview with zero automatic saving,
single-meal idempotent saving, label photo, recipe photo/PDF. Recheck source
fidelity, allergy exclusions, cooking units and expected content. Do not use real
customer uploads for new-provider tests without the appropriate authorization.

If acceptance fails, keep `gemini`. Roll back by selecting `gemini` and redeploying;
no schema change or data rollback is involved. Confirm the deployed commit and
actual provider behavior; adding an environment variable alone does not activate
code on an existing deployment.

## Review and current evidence

Claude reviewed this candidate privately on October 3. His timing, stacked-retry,
stream-cleanup and photo cancellation/format findings were addressed with tests.
Live OpenAI acceptance remains a release gate. Gemini remains
the default. No activation or successful OpenAI request is claimed by mock tests.
