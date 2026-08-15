import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Megaphone, Sparkles, Target, Users } from 'lucide-react';
import { HackathonWalkthrough } from './_components/hackathon-walkthrough';

export const metadata: Metadata = {
  title: 'Hackathon Demo | Recipe Reborn',
  description:
    'A judge-ready, no-account walkthrough of Recipe Reborn: processed ingredient label to a fresh recipe plan.',
};

const story = [
  {
    icon: Target,
    title: 'Problem',
    copy: 'Ingredient labels are hard to translate into an achievable homemade alternative. People need a practical starting point, not another list of warnings.',
  },
  {
    icon: Users,
    title: 'Target user',
    copy: 'Busy home cooks who want to understand a packaged product and explore a fresh version that fits their preferences and available time.',
  },
  {
    icon: Sparkles,
    title: 'Unique transformation',
    copy: 'Recipe Reborn turns label text into a structured recipe, then clearly separates detected label items from the generated fresh ingredient list.',
  },
  {
    icon: Megaphone,
    title: 'Why now',
    copy: 'Multimodal AI can finally read labels, reason over substitutions, and return a usable cooking workflow in one focused experience.',
  },
];

const channels = [
  'Short label-to-recipe demos on TikTok, Instagram Reels, and YouTube Shorts',
  'QR cards and demos with independent grocers, cooking classes, and community kitchens',
  'Search content for specific packaged-food alternatives and dietary preferences',
  'Referral moments built around saved recipes, collections, meal plans, and shopping lists',
];

export default function HackathonPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-950 text-white">
      {/* Opens straight into the walkthrough. The intro hero was removed so a
          judge lands on the demo itself rather than a page about the demo; the
          problem/user/why-now cards moved below it. */}
      <section id="walkthrough" className="scroll-mt-6 bg-stone-50 pb-16 pt-10 text-slate-950 sm:pt-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
              Judge walkthrough
            </p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">The core story, safely simulated</h2>
            <p className="mt-3 text-slate-600">
              The progress and cancel controls mirror the live generator. The transformation below
              is fixed synthetic content so this page stays deterministic and never creates data.
            </p>
          </div>
          <div className="mt-8">
            <HackathonWalkthrough />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {story.map(({ icon: Icon, title, copy }) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <Icon className="h-7 w-7 text-orange-300" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">{copy}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">Go to market</p>
          <h2 className="mt-2 text-3xl font-black">Show the transformation where cooks already look for ideas.</h2>
          <ul className="mt-6 space-y-4">
            {channels.map((channel) => (
              <li key={channel} className="flex gap-3 text-emerald-50/90">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden="true" />
                <span>{channel}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="rounded-3xl bg-orange-400 p-7 text-slate-950">
          <p className="text-sm font-bold uppercase tracking-[0.18em]">Call to action</p>
          <h2 className="mt-3 text-3xl font-black">Bring one ingredient label.</h2>
          <p className="mt-3 leading-7">
            Try the public example, then create an account only if you want to generate and organize
            your own recipes. Recipe outputs are starting points for cooking, not medical advice.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3 font-bold text-white outline-none transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-white/70"
          >
            Try Recipe Reborn
          </Link>
        </aside>
      </section>
    </main>
  );
}
