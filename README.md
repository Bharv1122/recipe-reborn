# 🌱 Recipe Reborn

> Transform processed food ingredient labels into fresh, healthy homemade recipes with AI.

**Live:** [recipereborn.com](https://recipereborn.com)

---

## ✨ What It Does

Upload a photo of any packaged food's ingredient label, and Recipe Reborn's AI will generate a fresh, nutritious recipe that replaces it — helping you move from processed to whole foods, one meal at a time.

---

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **UI:** React 19 + Tailwind CSS 4
- **Database:** Upstash Redis (serverless)
- **Auth:** JWT (jose) + bcryptjs
- **Deploy:** Vercel (auto-deploy from `main`)

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install
```bash
git clone https://github.com/Bharv1122/recipe-reborn.git
cd recipe-reborn
npm install
```

### 2. Set Up Environment
```bash
cp .env.example .env.local
```

Then fill in `.env.local`:
- **`JWT_SECRET`** — run `openssl rand -base64 32` and paste the result
- **Upstash Redis** — [create a free DB](https://console.upstash.com/redis), copy the REST URL + token

### 3. Run
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📜 Available Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | Lint code |

---

## 🌐 Deployment (Vercel)

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in **Project Settings → Environment Variables**:
   - `JWT_SECRET`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID` (optional)
4. Deploy — every push to `main` auto-deploys

---

## 🔒 Security Features

- ✅ JWT-based authentication (httpOnly cookies)
- ✅ Bcrypt password hashing
- ✅ Rate limiting on auth routes (5 signups / 10 logins per 10 min per IP)
- ✅ Input validation & sanitization
- ✅ Security headers (HSTS, X-Frame-Options, etc.)
- ✅ CSRF-safe via SameSite cookies

---

## 📈 SEO & Analytics

- ✅ Full Open Graph + Twitter Card metadata
- ✅ Auto-generated `sitemap.xml` and `robots.txt`
- ✅ Structured data (Schema.org)
- ✅ Google Analytics 4 (opt-in via env var)
- ✅ Mobile-friendly + PWA manifest

---

## 📂 Project Structure

```
src/
├── app/              # Pages & API routes (App Router)
│   ├── api/          # Serverless API endpoints
│   ├── layout.tsx    # Root layout (SEO + GA)
│   ├── sitemap.ts    # Auto-generated sitemap
│   └── robots.ts     # Auto-generated robots.txt
├── components/       # Reusable React components
├── lib/              # Helpers (auth, db, rate-limit, validation)
└── middleware.ts     # Security headers
```

---

## 🤝 Contributing / Development

This project uses **Claude Code CLI** for AI-assisted development.
See [`CLAUDE.md`](./CLAUDE.md) for project context that Claude auto-reads.

Typical workflow:
```bash
claude              # start Claude Code
/effort xhigh       # use high effort for Opus 4.7
/ultraplan <task>   # plan complex changes in the cloud
```

---

## 📝 License

Private project © 2026 Recipe Reborn.
