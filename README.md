# Recipe Reborn — Next Steps (simple step-by-step)

This project contains the code for Recipe Reborn. Below are simple, step-by-step instructions to run locally, deploy to Vercel, and connect your domain on Cloudflare.

## Run locally (very simple)
1. Install Node.js (recommend version 18 or 20). Download from https://nodejs.org/.
2. Open a terminal (Command Prompt / Terminal) and run:
   - `cd` to this project folder (where package.json lives).
   - Run `npm install`
   - Run `npm run dev` (this starts the frontend dev server)
   - In a second terminal run `npm run start:server` (this starts the API server that receives waitlist emails)
3. Frontend will often be on `http://localhost:5173`. Open that in your browser.

## Deploy to Vercel (very simple)
0. Create a GitHub repository and push this project to it (I can give exact commands if you want).
1. Go to https://vercel.com, create an account and connect your GitHub.
2. Create a new project in Vercel and import the GitHub repo.
3. Set environment variables in Vercel dashboard (Settings → Environment Variables) BEFORE deploying:
   - SUPABASE_URL (if using Supabase)
   - SUPABASE_KEY
   - STRIPE_SECRET (for payments)
4. Deploy. After the first deploy, add your domain `recipereborn.com` in Vercel's domain settings and follow the prompt.

## Cloudflare (domain settings)
- Your domain is already registered in Cloudflare. Vercel will give you DNS records to add in Cloudflare. Add those records exactly as Vercel instructs.
- In Cloudflare, set SSL/TLS to "Full".

## Security note
If you posted any passwords in the chat earlier, change those passwords now. Don't store production keys in the repo; use environment variables in Vercel.

If you want, I can give you exact terminal commands to commit and push to GitHub and step-by-step screenshots. Just say: "Give me the Git commands" and I'll provide them.
