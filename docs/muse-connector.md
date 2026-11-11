# Recipe Reborn — Muse connector (MCP)

Status: **built and tested locally; NOT submitted to Meta.** Beth submits when ready.

## What it is

A public, read-only MCP server at **`https://recipereborn.com/api/mcp`** (streamable HTTP, stateless,
JSON responses) built with the official `@modelcontextprotocol/sdk`. Muse (or any MCP client) can
use it to find Recipe Reborn's homemade versions of packaged foods, get full recipes, build
shopping lists and look up ingredient swaps.

v1 is deliberately **no-auth**:

- Tools read only the house catalog (`lib/public-recipes.ts`, 8 recipes written for Recipe Reborn)
  and a static swap table (`lib/substitutions.ts`). **No database, no user accounts, no user
  recipes, no personal data** in or out.
- **No AI calls** → no per-request cost to abuse.
- Rate limited: 60 requests/minute per IP (Upstash, same as the rest of the site) plus an
  in-memory per-instance backstop because the Upstash limiter fails open by design.
- Bodies capped at 32 KB, batches at 10 messages; every tool input is schema-validated
  (length caps, id pattern, no control characters, servings 1–48).
- Errors never echo internals or secrets.
- No weight-loss / medical / "diet for a condition" wording anywhere; the test enforces this over
  every tool description and output.

Code: `app/api/mcp/route.ts` → `lib/mcp/http.ts` (transport, limits) → `lib/mcp/recipe-server.ts` (tools).
Test: `npm run verify:muse-mcp` (drives the real handler through the official MCP client; no network).

## Submission form (muse.ai/platform → "Existing MCP")

> The field names below follow the brief we were given (name, description, example prompts, tools,
> privacy/terms, icon, auth). Muse launched after the tooling used here was built, so **check the
> live form's exact fields before pasting.**

| Field | Value |
| --- | --- |
| Integration type | Existing MCP server |
| Name | Recipe Reborn |
| Short description | Homemade versions of packaged foods — recipes, shopping lists and ingredient swaps. |
| Long description | Recipe Reborn turns packaged foods into simple homemade recipes. Ask for a homemade version of something you usually buy (tomato soup, ranch dressing, granola bars, taco seasoning, pancake mix…), get the full ingredient list and numbered steps scaled to your servings, a grocery list grouped by store aisle, or a quick swap when you're out of an ingredient. Every recipe links to Recipe Reborn's hands-free kitchen mode for cooking step by step on a tablet or Meta Quest. |
| MCP endpoint URL | `https://recipereborn.com/api/mcp` |
| Transport | Streamable HTTP (POST, JSON responses, stateless — no session id) |
| Authentication | None (public, read-only tools; no user data) |
| Category | Food & cooking |
| Icon (512×512 PNG) | `public/muse-icon-512.png` → `https://recipereborn.com/muse-icon-512.png` (cropped from `public/logo-mark.png`) |
| Privacy policy URL | `https://recipereborn.com/privacy` |
| Terms of service URL | `https://recipereborn.com/terms` |
| Support URL / contact | `https://recipereborn.com/support` · support@recipereborn.com |
| Developer | Recipe Reborn (Beth Harvey) |

### Example prompts (pick 3–5)

1. "Find me a homemade version of canned tomato soup and make it for 6 people."
2. "I want to stop buying bottled ranch — how do I make it at home?"
3. "Make a shopping list for Recipe Reborn's granola bars."
4. "I'm out of buttermilk. What can I use in pancakes instead?"
5. "What can I make in under 20 minutes that replaces a packaged food?"

### Tools

| Tool | What it does | Inputs |
| --- | --- | --- |
| `search_recipes` | Keyword search of the public recipe collection; returns short cards with ids and a kitchen-mode link | `query?` (≤120 chars), `tag?` (vegetarian, vegan, kid-friendly, quick, make-ahead, one-pot, no-cook, snack, breakfast, sheet-pan, pantry), `maxTotalMinutes?`, `limit?` (1–10) |
| `get_recipe` | Full ingredients + numbered steps, optionally scaled | `recipeId`, `servings?` (1–48) |
| `shopping_list_for_recipe` | Grocery list scaled and grouped by aisle | `recipeId`, `servings?` (1–48) |
| `substitute_ingredient` | Cooking/baking swaps with ratios and how the result changes | `ingredient` (2–80 chars) |

All four are annotated `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`.

## Verified vs. not verified

Verified here (sandbox, 2026-09-30):

- ✅ `npm run verify:muse-mcp` passes: tool discovery, all four tools, scaling, unknown ids, input
  validation, no health claims / PII / secrets in any output, 405 on GET, 413 on big bodies,
  400 on bad JSON / big batches, 429 after 60 calls/min per IP.
- ✅ Real HTTP against a local production build (`next start`): `initialize` and `tools/call` return correct JSON-RPC.
- ✅ `/privacy`, `/terms`, `/support` and `/cookies` exist in the app (`app/privacy`, `app/terms`,
  `app/support`, `app/cookies`) and return 200 on the local production build; the privacy page and
  support page list support@recipereborn.com.

Not verified (flag for Beth):

- ⚠️ **Live URLs not checked**: this sandbox's network policy blocks `recipereborn.com`, so the
  production privacy/terms/support pages and `/api/mcp` were not fetched live. After this PR
  deploys, open each URL once (and run the curl below) before submitting.
- ⚠️ The privacy policy doesn't mention the Muse connector. Nothing personal is collected (the IP is
  used only transiently for rate limiting, like every other API route), so it's probably fine —
  but Beth may want a one-line mention before submission.
- ⚠️ Muse's live form fields and review rules weren't available to check (see note above).
- ⚠️ `/api/mcp` is not tested with Muse itself.

### Post-deploy smoke test

```bash
curl -s -X POST https://recipereborn.com/api/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_recipes","arguments":{"query":"ranch"}}}'
```

## Later (v2 ideas — need decisions)

- Account-linked tools (save a recipe, add to a shopping list) → OAuth 2.1 + PKCE, per-user limits.
- Searching users' **publicly shared** recipes: technically easy (`isPublic` + `shareToken`), but
  people shared those links with friends, not with AI agents — needs Beth's call and probably a
  consent toggle first.
- Any AI-generated tool (e.g. "reborn this label") needs a hard per-day cap before going public.
