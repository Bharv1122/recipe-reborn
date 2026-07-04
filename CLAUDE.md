# CLAUDE.md — Recipe Reborn Project Context

> Auto-read by Claude Code at session start.

---

## 🎯 Project Overview

**Recipe Reborn** transforms processed food ingredient labels into fresh, healthy homemade recipes. Photograph a label (or paste ingredients / import a URL) → AI generates a whole-food recipe that replaces the packaged product.

**Live URL:** https://recipereborn.com
**GitHub:** Bharv1122/recipe-reborn
**Owner:** Beth (bethharvey11@gmail.com)

**History:** Originally built on Abacus.AI (full-featured, formerly live with Stripe). Restored 2026-07-03 from the Dec 2025 handoff archive onto this repo (branch `restore-full-app`), modernized to Gemini + Supabase + Vercel. The interim "rebuild" (Next 16 + Redis + JWT) was replaced wholesale — do not consult old commits for architecture.

---

## 🛠 Tech Stack (current — do not "upgrade" without asking Beth)

- **Framework:** Next.js 14.2 (App Router) + React 18 + TypeScript
- **DB:** Supabase Postgres via **Prisma** (project ref: `sdcvpykbizbsoekuafcf`, us-east-1)
  - App uses transaction pooler (port 6543, `?pgbouncer=true&connection_limit=1`)
  - Migrations use `DIRECT_URL` (session pooler, port 5432)
- **Auth:** NextAuth v4 (credentials + Prisma adapter, JWT sessions)
- **AI:** Gemini via OpenAI-compatible endpoint — ALL AI calls go through constants in `lib/ai.ts` (`MODEL_SMART`/`MODEL_FAST`). Never hardcode provider URLs in routes.
- **Payments:** Stripe (products/prices already exist; free tier = 3 recipes/month)
- **UI:** Tailwind + shadcn/ui (45+ components in `components/ui/`)
- **Deploy:** Vercel (auto-deploy from `main`; domain attached)
- **Package manager:** npm (install with `--legacy-peer-deps` — eslint 9 vs @typescript-eslint 7 conflict; build skips lint)

## 📁 Key Structure

```
app/                  # pages: generator, recipes, meal-planner, shopping-lists,
                      # collections, pricing, account, share/[shareToken], legal
app/api/              # ~40 routes; AI routes import from lib/ai.ts
lib/ai.ts             # Gemini endpoint + model constants (single source of truth)
lib/stripe.ts         # Stripe client + PRICING_PLANS
lib/auth-options.ts   # NextAuth config
prisma/schema.prisma  # 12 models; binaryTargets includes rhel-openssl-3.0.x for Vercel
```

## ✅ Standards

1. TypeScript strict; `npm run build` must pass before pushing (build runs `prisma generate` first)
2. Server components by default; `"use client"` only when needed
3. All AI routes: import `AI_CHAT_URL`, `AI_API_KEY`, model constants from `@/lib/ai`
4. Free-tier generation limits are enforced in `generate-recipe` and `import-recipe` routes — keep limit text and `TIER_LIMITS` in sync with `lib/stripe.ts` and pricing/account pages
5. Never commit `.env` (gitignored); secrets live in Vercel env vars

## 🚫 Gotchas

- `prisma migrate dev` hanging = pooled URL being used; migrations need `DIRECT_URL`
- Windows: close dev server before `prisma generate` (EPERM on client DLL)
- Stripe SDK pins `apiVersion: '2026-02-25.clover'` — update both `lib/stripe.ts` and `app/api/webhooks/stripe/route.ts` together if bumping the SDK
- `app/api/transcribe-audio` now transcribes via Gemini (`input_audio` on the OpenAI-compatible endpoint) as the fallback for browsers without SpeechRecognition — Phase 3a shipped (cooking mode, TTS, voice commands, recipe chat)
- Supabase RLS: `postgres` role (Prisma) has `bypassrls` — enabling RLS on tables does not affect the app

## 🎯 Roadmap

Phase 2 (relaunch): SEO/security graft from old `main`, Stripe re-wiring (3-recipe free tier, yearly price in webhook mapping, `allow_promotion_codes`), Vercel deploy.
Phase 3: voice (browser SpeechRecognition + Gemini audio), barcode scan (OpenFoodFacts), USDA nutrition, "you saved $X" cost compare, Instacart shopping-list handoff.
Full plan: `C:\Users\bethh\.claude\plans\ok-so-i-would-zesty-dewdrop.md`

## 🤝 Working With Beth

- She's new to coding — explain the "why" briefly, not just the "what"
- Keep changes scoped; don't refactor unrelated code
- Clear commit messages referencing the feature
