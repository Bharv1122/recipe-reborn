# Recipe Reborn plugin 0.1.0

Authenticated MCP server and MCP Apps panel for an existing Recipe Reborn account.
This checkout is a development package, not a published directory listing.

## Supported workflows

- Search/open your saved recipes; read your meal plans and shopping lists.
- Scale ingredient quantities without changing the saved recipe or cooking instructions.
- Read an existing saved wine pairing (Premium, adults of legal drinking age).
- Preview and confirm recipe generation, recipe saving, weekly-plan generation and shopping-list creation.
- Read current membership; existing server membership, allowance and food-safety checks remain authoritative.

No billing actions, subscriptions, account deletion, arbitrary URLs, cross-account access,
new wine generation or Android release actions are exposed. Recipe generation returns
an unsaved result; saving requires a separate preview and confirmation. Ranges and
unrecognized ingredient quantities are not scaled. Verify amounts and cooking safety.

## Local verification

From the repository root, after installing locked dependencies and generating Prisma:

```sh
npm run verify:plugin
npx tsc --noEmit --incremental false
npm run preview:plugin
```

Open http://127.0.0.1:4181/ for the clearly labeled synthetic MCP Apps host simulator.
It runs the real OAuth/MCP/confirmation code with an in-memory synthetic backend,
never contacts real accounts, a database or an AI provider, and is not a ChatGPT demo.
The sample shopping-list button previews an action; the panel confirmation creates
only an in-memory list. Stop the process to discard it.

The two MCP manifests point to a **different** development server on port 4180.
To test real account linking, run `npx next dev --hostname 127.0.0.1 --port 4180`
with a designated test database and the configuration below. The synthetic host is
not an unauthenticated substitute for that MCP endpoint.

## Hosting configuration (not secrets to commit)

| Variable | Required value |
| --- | --- |
| `PLUGIN_ENABLED` | `true`, only after secure storage and approved clients are ready |
| `PLUGIN_ORIGIN` | Exact HTTPS origin of the existing Recipe Reborn deployment; no trailing slash |
| `PLUGIN_OAUTH_CLIENTS` | JSON object keyed by registered public client ID; each value has `name` and an exact `redirectUris` allowlist supplied by the host |
| `PLUGIN_REDIS_REST_URL` | Existing healthy Upstash Redis REST endpoint |
| `PLUGIN_REDIS_REST_TOKEN` | Matching secret stored only in the hosting secret manager |

The usual Recipe Reborn database, NextAuth session/secret and generation-provider
configuration must also work. No new database migration is required. Never point a
local synthetic demo at production or place tokens, reviewer passwords or real user
data in the package. Never disable authentication to pass an automated scan.

Production fails closed when plugin configuration or durable storage is unavailable.
No in-memory production fallback exists. Redis uses a separate `recipe-plugin:v1:`
namespace for grants, hashed token records, confirmations and rate counters. Do not
reuse a deleted or unverified Redis integration. A new paid service is not authorized.

## Account linking and security

Authorization: `/api/plugin/authorize`; token exchange: `/api/plugin/token`;
revocation: `/api/plugin/revoke`; MCP: `/api/plugin/mcp`.
Discovery: `/.well-known/oauth-authorization-server` and
`/.well-known/oauth-protected-resource`.

- Signed-in Recipe Reborn session, escaped consent, nonce cookie and same-origin POST.
- Pre-registered public clients only; exact redirect URI, state, S256 PKCE and resource binding.
- One-use 120-second codes; opaque 15-minute access tokens; rotating refresh tokens
  with a 30-day grant lifetime, replay-family revocation and revocation endpoint.
- Per-request account existence, tenant-filtered reads, live membership and quota checks.
- Subject/grant-bound immutable action previews expire in five minutes and are
  atomically consumed before work. An uncertain write is not automatically retried.
- The host must obtain actual user confirmation. A model-provided `confirmed: true`
  alone cannot cryptographically prove a human clicked; the panel provides a direct
  confirmation control and the skill requires explicit confirmation.
- Plugin tokens are never forwarded. A 60-second internal native JWT is used only
  in-process to invoke fixed existing handlers; it is never returned to clients.
- Recipe content is untrusted data, rendered with textContent, never executable HTML.
- No external panel connections/assets; no credentials or billing identifiers in output.

The host should invoke revocation when disconnecting. There is no account-settings
grant-management screen in version 0.1.0. Do not promise that uninstalling a host
automatically revokes tokens if that host has not verified its revoke behavior.

## Release gates

1. Configure healthy durable storage and exact host client callbacks in the existing
   hosting project. Verify real OAuth and route-specific logs with a designated test account.
2. Deploy only the reviewed plugin changes and required security patch. Confirm the
   panel HTML is included in the MCP function bundle and unauthorized MCP access is denied.
3. Change BOTH MCP manifest URLs from localhost to the verified public HTTPS MCP URL.
4. In the OpenAI Plugins portal, use the owner's verified publishing identity. Keep
   credentials outside the ZIP. Publish the exact domain challenge obtained there;
   do not invent or overwrite another plugin's challenge.
5. Run the live review cases in REVIEW.md, record a genuine walkthrough, package the
   plugin, upload it, resolve scans and obtain approval before directory publication.

Public listing, approval and deployment are separate stages. A passing local test
or a pushed PR does not demonstrate hosted OAuth or public availability.
