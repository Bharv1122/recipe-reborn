# CLAUDE.md — Recipe Reborn Project Context

> This file is auto-read by Claude Code CLI at session start.
> Front-loading context here saves tokens and improves output quality (Opus 4.7 best practice).

---

## 🎯 Project Overview

**Recipe Reborn** is an AI app that transforms processed food ingredient labels into fresh, healthy homemade recipes.

**Unique Value Proposition:** Users upload a photo of a packaged food's ingredient label → AI generates a fresh, nutritious recipe that replaces it.

**Live URL:** https://recipereborn.com  
**GitHub:** Bharv1122/recipe-reborn  
**Owner:** Beth (bethharvey11@gmail.com)

---

## 🛠 Tech Stack

- **Framework:** Next.js 16.1.4 (App Router, Turbopack)
- **Language:** TypeScript 5 (strict mode)
- **UI:** React 19.2.3 + Tailwind CSS 4
- **Database:** Upstash Redis (serverless key-value)
- **Auth:** JWT via `jose` + bcryptjs
- **Deployment:** Vercel (auto-deploy from `main`)
- **Analytics:** Google Analytics 4 (via env var)
- **Package manager:** npm

**Do NOT switch to:** yarn, pnpm, bun, or any other framework.

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes (serverless functions)
│   │   ├── auth/           # login, signup, logout, me
│   │   └── recipes/        # CRUD for recipes
│   ├── layout.tsx          # Root layout (SEO, GA, metadata)
│   ├── sitemap.ts          # Auto-generated sitemap
│   ├── robots.ts           # Auto-generated robots.txt
│   └── [routes]/page.tsx   # Individual pages
├── components/             # Shared React components
├── lib/                    # Utilities (rate-limit, validation)
└── middleware.ts           # Security headers
```

---

## 🎨 Design System

**Brand Color:** Emerald green
- Primary: `#14AB42` (hero gradient top)
- Dark: `#054E3A` (hero gradient bottom)
- Accent: `emerald-600` / `emerald-700` (Tailwind)

**CTA Button Style:**
```tsx
className="bg-emerald-600 text-white border-2 border-emerald-700 hover:bg-emerald-700 font-bold text-lg px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all"
```

**NEVER** use white text on white backgrounds (this was the original bug — now fixed).

---

## ✅ Coding Standards

1. **TypeScript strict** — no `any` unless justified in a comment
2. **Server components by default** — only use `"use client"` when needed (hooks, events)
3. **Tailwind classes** — no inline styles except for dynamic values (gradients)
4. **Positive examples** over negative rules (Opus 4.7 prefers this)
5. **Validate all API inputs** using `src/lib/validation.ts`
6. **Rate-limit all public API routes** using `src/lib/rate-limit.ts`
7. **No `console.log`** in production code — use proper error handling

---

## 🎯 Current Priorities (Week 2)

Ranked by impact:

1. **🔴 HIGH: Image upload + OCR** — Users should upload a photo of an ingredient label and the AI extracts text. This is the CORE differentiator. Use:
   - `next/image` for display
   - Tesseract.js (free, runs in browser) or OpenAI Vision API
   - Store uploads in Vercel Blob or Upstash

2. **🟡 MEDIUM: Nutrition comparison view** — Show before/after nutritional breakdown side-by-side

3. **🟡 MEDIUM: Recipe search/filter** on `/my-recipes` page

4. **🟢 LOW: Shopping list generator** from saved recipes

---

## 🚫 Known Issues / Gotchas

- `JWT_SECRET` in `.env.example` is a placeholder — production uses Vercel env vars
- Upstash free tier = 10k requests/day (watch usage when scaling)
- Turbopack is enabled by default — don't revert to Webpack
- Next.js 16 requires React 19 — don't downgrade

---

## 🔁 Common Workflows

### Adding a new page
```bash
# In Claude:
/effort xhigh
Create a new page at src/app/[name]/page.tsx with:
- Proper SEO metadata export
- Matches existing emerald design system
- Mobile-responsive
- Server component if possible
```

### Adding a new API route
```bash
# Always include:
1. Rate limiting (import from @/lib/rate-limit)
2. Input validation (import from @/lib/validation)
3. Try/catch with proper status codes
4. TypeScript types for request/response
```

### Before pushing to main
```bash
npm run build  # Must pass with zero errors
npm run lint   # Must pass
```

---

## 🔐 Environment Variables

Required (set in Vercel):
```
JWT_SECRET                        # openssl rand -base64 32
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Optional:
```
NEXT_PUBLIC_GA_MEASUREMENT_ID     # Google Analytics (G-XXXXXXXXXX)
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
```

---

## 🤝 Working With Me (Claude)

When Beth (the owner) asks for help:

- **She's new to coding** — explain the "why" briefly, not just the "what"
- **Keep changes scoped** — don't refactor unrelated code
- **Always run `npm run build` mentally** before claiming work is done
- **Commit messages** should be clear and reference the feature (e.g., `feat: add image upload to recipe generator`)
- **Use Plan mode first** (`Shift+Tab` twice) for any multi-file change

---

*Last updated: April 21, 2026 by Abacus AI Agent*
