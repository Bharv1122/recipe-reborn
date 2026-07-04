# Recipe Reborn — Execution Roadmap (2026-07-03)

Working copy: `C:\Users\bethh\Documents\recipe-reborn`, branch `restore-full-app` (pushed).
State: Phase 1 complete & verified (see CLAUDE.md). Live site recipereborn.com still runs the old shell — closing that gap is the mission.
Protocol: worker agents EDIT ONLY (no git commands, no .env changes, no killing the dev server). Lead session reviews diffs and commits per package. Build check: `./node_modules/.bin/next build` (skip prisma generate — Windows DLL lock while dev server runs).

## Phase 2 work packages (all approved by Beth 2026-07-03)

### WP1 — Stripe & monetization fixes
- Free tier 10 → 3 in all five places: `app/api/generate-recipe/route.ts` (TIER_LIMITS + limit message), `app/api/import-recipe/route.ts` (same), `app/account/page.tsx` (TIER_LIMITS record, `|| 10` fallback, bullet text), `lib/stripe.ts` (PRICING_PLANS text), `app/pricing/page.tsx` (currently says "5")
- `app/api/webhooks/stripe/route.ts`: `handleSubscriptionChange` must map `STRIPE_YEARLY_PRICE_ID` → tier "premium" (today yearly buyers would land on "free")
- `app/api/create-checkout-session/route.ts`: add `allow_promotion_codes: true` (1STMONTHOFF is unusable without it)
- `app/pricing/page.tsx`: TRANSFORM (don't delete) the "Pro $19.99" card into "Premium Yearly — $99/yr (save 17%)"; final tiers: Free (3 recipes/mo) / Premium $9.99/mo / Premium Yearly $99/yr. Wire yearly card to `NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID`.
- Keep `lib/stripe.ts` PRICING_PLANS + account page tier display consistent with the above.

### WP2 — Security, SEO, RLS, og-image
- Graft from the retired rebuild at `C:\Users\bethh\AppData\Local\Temp\claude\C--Users-bethh\a6246aad-95e8-4405-8b28-e5b3117b5944\scratchpad\recipe-reborn\src\`:
  - `middleware.ts` → repo root (security headers)
  - `app/sitemap.ts` + `app/robots.ts` rewritten for old-app routes (sitemap: /, /generator, /pricing, /signup, /login, /privacy, /terms, /cookies; robots disallow /api/, /account, /recipes, /meal-planner, /shopping-lists, /collections, /success; keep /share/ crawlable)
  - `app/layout.tsx`: merge metadata extras (manifest, verification.google, JSON-LD, GA Script blocks, icons, `metadataBase: https://recipereborn.com`)
  - `lib/rate-limit.ts` verbatim + `npm i @upstash/redis --legacy-peer-deps`; apply: signup 5/min/IP, generate-recipe + extract-recipe-from-photo 10/min/user, public share routes 30/min/IP (fails open without Redis)
- RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all 12 public tables of Supabase project `sdcvpykbizbsoekuafcf` (verified safe: Prisma's postgres role has bypassrls=true). Post-check: one Prisma SELECT still works.
- Regenerate `public/og-image.png` (1200x630): brand green #0b8540 background + logo.png centered (PowerShell System.Drawing).

### WP3 — Mobile navigation
- `components/header.tsx`: responsive hamburger using existing `components/ui/sheet.tsx` (shadcn). Desktop ≥lg unchanged; below lg: emblem + wordmark left, hamburger right → Sheet with all nav links + logout/login. Match white-on-green styling. No horizontal overflow at 375px.

### WP4 — Voice tab graceful patch (full voice is Phase 3a)
- `app/generator/_components/voice-chat.tsx`: prefer browser `SpeechRecognition`/`webkitSpeechRecognition` for input; if unavailable and `/api/transcribe-audio` returns 501, show a friendly inline notice ("Voice input works in Chrome, Edge, or Safari — or just type your ingredients") instead of a raw error. Conversational chat POST (`/api/voice-chat`) already works via Gemini — don't touch the endpoint.

## Beth-only actions (do anytime, ~10 min total)
1. **Stripe dashboard** (dashboard.stripe.com): copy fresh live Secret key + Publishable key; verify product prod_TXr1hplLxFWdqG, both prices, and promo 1STMONTHOFF are active. (Webhook endpoint gets created at deploy time — checklist below.)
2. **Instacart Developer Platform**: apply for API access NOW (approval is the long pole for the post-launch shopping handoff).
3. **At deploy**: paste env vars into Vercel (exact list below).

## Deploy checklist (lead session runs this after WP1-4 reviewed & committed)
1. Merge `restore-full-app` → `main` via PR (Vercel auto-deploys; domain already attached)
2. Vercel env (Production): DATABASE_URL (pooled), DIRECT_URL, NEXTAUTH_URL=https://recipereborn.com, NEXTAUTH_SECRET (fresh), GEMINI_API_KEY, STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PREMIUM_PRICE_ID=price_1SalJH2R7jIOetZq2fkQTCsr, STRIPE_YEARLY_PRICE_ID=price_1SbNt72R7jIOetZqxWesonJw (+ NEXT_PUBLIC_ twins), UPSTASH_REDIS_REST_URL/TOKEN (already on the Vercel project from the rebuild), optional GA vars
3. Stripe webhook endpoint → https://recipereborn.com/api/webhooks/stripe (subscription created/updated/deleted, invoice payment_succeeded/failed) → set STRIPE_WEBHOOK_SECRET
4. Production smoke test: signup→login; 3 recipes then 4th blocked (message says 3); photo extract; checkout w/ 1STMONTHOFF real card → premium → cancel → reverts; webhook 200s; share link logged out; sitemap/robots/headers; meal planner + shopping CRUD; mobile nav at 375px.

## Phase 3 backlog (post-launch, spawn-task chips created)
3a voice done right (Gemini audio transcription + TTS + cooking mode) · 3c barcode scan via OpenFoodFacts · 3d USDA FoodData Central real nutrition · 3e "you saved $X" cost compare · 3f Instacart handoff (post-approval) · i18n restore (lowest priority). Specs in the approved plan: `C:\Users\bethh\.claude\plans\ok-so-i-would-zesty-dewdrop.md` + docs in `OneDrive\Desktop\RR PICS\`.
