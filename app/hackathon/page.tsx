import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Walkthrough | Recipe Reborn',
  description:
    'A recorded walkthrough of Recipe Reborn: a processed ingredient label turned into a fresh recipe.',
};

/**
 * /hackathon is the walkthrough video and nothing else.
 *
 * The interactive demo card, the pitch cards and the go-to-market section that
 * used to live here were removed. The URL is kept rather than deleted because
 * it was already shared publicly — anyone following that link lands on the
 * video, which is what they came for.
 */
export default function WalkthroughPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-300">
          Walkthrough
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
          A label, turned into dinner
        </h1>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
          <video
            className="h-auto w-full"
            controls
            preload="metadata"
            playsInline
            poster="/recipe-reborn-demo-poster.jpg"
          >
            <source src="/recipe-reborn-demo.mp4" type="video/mp4" />
            Your browser doesn&apos;t support video. Recipe Reborn turns any processed
            ingredient label into a fresh homemade recipe.
          </video>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-400 px-6 py-3 font-bold text-slate-950 outline-none transition hover:bg-orange-300 focus-visible:ring-4 focus-visible:ring-orange-200"
          >
            Try Recipe Reborn
          </Link>
        </div>
      </div>
    </main>
  );
}
