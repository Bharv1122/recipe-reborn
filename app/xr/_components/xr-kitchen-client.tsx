'use client';

import { useEffect, useRef, useState } from 'react';
import type { KitchenMode, XrKitchen } from '../_lib/kitchen';

type Support = { ar: boolean; vr: boolean; checked: boolean };

declare global {
  interface Window {
    __rrKitchen?: XrKitchen;
  }
}

/**
 * The 2D page around the XR scene. On a desktop or phone it shows a live,
 * clickable preview of the same panels; in a Meta Quest browser it offers
 * "Enter mixed reality" (passthrough) and "Enter VR".
 */
export function XrKitchenClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const kitchenRef = useRef<XrKitchen | null>(null);
  const [support, setSupport] = useState<Support>({ ar: false, vr: false, checked: false });
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let instance: XrKitchen | null = null;
    // three.js touches window/document, so load it only in the browser.
    void import('../_lib/kitchen').then(async ({ XrKitchen: Kitchen }) => {
      if (cancelled || !containerRef.current) return;
      const showHands = new URLSearchParams(window.location.search).get('hands') === 'visible';
      instance = new Kitchen(
        containerRef.current,
        {
          onSessionChange: (isActive) => setActive(isActive),
          onStateChange: (summary) => setResume(summary),
        },
        showHands
      );
      kitchenRef.current = instance;
      window.__rrKitchen = instance;
      setReady(true);
      const [ar, vr] = await Promise.all([Kitchen.supported('immersive-ar'), Kitchen.supported('immersive-vr')]);
      if (!cancelled) setSupport({ ar, vr, checked: true });
    });
    return () => {
      cancelled = true;
      instance?.dispose();
      kitchenRef.current = null;
      if (window.__rrKitchen === instance) delete window.__rrKitchen;
    };
  }, []);

  const enter = async (mode: KitchenMode) => {
    setError(null);
    try {
      await kitchenRef.current?.enter(mode);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not start the headset view: ${err.message}`
          : 'Could not start the headset view.'
      );
    }
  };

  const noXr = support.checked && !support.ar && !support.vr;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-950 to-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-300">
          Hands-first mixed reality
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
          Recipe Reborn Kitchen
        </h1>
        <p className="mt-3 max-w-3xl text-base text-emerald-100/80 sm:text-lg">
          Pick a packaged food, see what is really on its label, then cook the fresh version with
          step cards, a checklist and timers floating over your real counter. Pinch or poke with
          bare hands. No controllers, no account.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void enter('immersive-ar')}
            disabled={!support.ar || active}
            className="rounded-full bg-emerald-500 px-6 py-3 text-base font-bold text-emerald-950 shadow-lg transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enter mixed reality
          </button>
          <button
            type="button"
            onClick={() => void enter('immersive-vr')}
            disabled={!support.vr || active}
            className="rounded-full border border-white/30 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enter VR
          </button>
          {resume ? (
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100">
              Resumes at: {resume}
            </span>
          ) : null}
        </div>

        {noXr ? (
          <p className="mt-4 max-w-3xl rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            This browser has no headset support, so you are seeing the desktop preview. Open{' '}
            <span className="font-semibold">recipereborn.com/xr</span> in the Meta Quest browser to
            cook in mixed reality.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <div
          ref={containerRef}
          aria-label="Recipe Reborn kitchen preview. Click the floating panels to try it."
          className="relative mt-6 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl sm:aspect-[16/9]"
        >
          {!ready ? (
            <div className="absolute inset-0 flex items-center justify-center text-emerald-100/70">
              Loading the kitchen…
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-emerald-100/60">
          Desktop preview: click the panels. In the headset, pinch to tap, poke with a fingertip,
          and pinch-hold a panel&apos;s top bar to move it.
        </p>
      </div>
    </main>
  );
}
