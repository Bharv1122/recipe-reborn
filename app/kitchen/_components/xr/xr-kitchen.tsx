'use client';

import { Component, Suspense, useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { Canvas, useThree } from '@react-three/fiber';
import { PointerEvents, XR, createXRStore, noEvents, useXR } from '@react-three/xr';
import type { KitchenRecipe } from '@/lib/kitchen/engine';
import { KITCHEN_HELP } from '@/lib/kitchen/engine';
import { useKitchen } from '@/lib/kitchen/use-kitchen';
import KitchenScene, { type XRLayout } from './kitchen-scene';
import '../../kitchen.css';

/**
 * WebXR kitchen for Meta Quest (and other WebXR headsets / glasses).
 * Prefers immersive-ar (full-color passthrough, so you see your real kitchen)
 * and falls back to immersive-vr. Hands first: pinch (ray) and poke work on
 * every control; controllers and voice are optional extras.
 *
 * This module is only ever loaded through next/dynamic with ssr:false from
 * the /kitchen/[recipeId]/xr route, so three.js never lands in other pages.
 */

// `?emulate=1` turns on the Meta Quest emulator for desktop testing (never on by default).
const emulate =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('emulate')
    ? ({ type: 'metaQuest3', syntheticEnvironment: false } as const)
    : false;

const store = createXRStore({
  emulate,
  // Keep fill-rate low on mobile headsets: 72 Hz when offered, fixed foveation.
  frameRate: (rates) => (Array.from(rates).includes(72) ? 72 : false),
  foveation: 0.75,
  hand: { rayPointer: { rayModel: { color: '#22c55e' } } },
  controller: { rayPointer: { rayModel: { color: '#22c55e' } } },
});

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="rx-fallback" role="alert">
        <strong>The 3D view couldn’t start on this device.</strong>
        <p>Kitchen mode on a screen works everywhere.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}

function PreviewCamera({ layout }: { layout: XRLayout }) {
  const { camera, size } = useThree();
  const session = useXR((s) => s.session);
  useEffect(() => {
    if (session) return;
    // Portrait screens need a wider shot so both side panels stay in frame.
    const back = Math.max(1, Math.min(2.6, (1.35 * size.height) / size.width));
    const d = layout === 'seated' ? 0.46 : 0.62;
    camera.position.set(0, 1.27 + 0.05 * back, -d + 0.78 * back);
    camera.lookAt(0, 1.24, -d);
  }, [camera, session, size.width, size.height, layout]);
  return null;
}

type Support = { vr: boolean; ar: boolean; checked: boolean };
function useXRSupport() {
  const [s, set] = useState<Support>({ vr: false, ar: false, checked: false });
  useEffect(() => {
    let live = true;
    const check = () => {
      const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
      if (!xr) {
        if (live) set((s) => ({ ...s, checked: true }));
        return;
      }
      Promise.all([
        xr.isSessionSupported('immersive-vr').catch(() => false),
        xr.isSessionSupported('immersive-ar').catch(() => false),
      ]).then(([vr, ar]) => live && set({ vr, ar, checked: true }));
    };
    check();
    // Headsets can connect late, and the ?emulate=1 emulator installs navigator.xr asynchronously.
    const retry = window.setTimeout(check, 2000);
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    xr?.addEventListener('devicechange', check);
    return () => {
      live = false;
      window.clearTimeout(retry);
      xr?.removeEventListener('devicechange', check);
    };
  }, []);
  return s;
}

export default function XRKitchen({ recipe, exitHref }: { recipe: KitchenRecipe; exitHref: string }) {
  const k = useKitchen(recipe);
  const support = useXRSupport();
  const inSession = useSyncExternalStore(
    store.subscribe,
    () => !!store.getState().session,
    () => false
  );
  const [layout, setLayout] = useState<XRLayout>('standing');
  const [recenterKey, setRecenterKey] = useState(0);
  const [enterError, setEnterError] = useState('');
  const onRecenter = useCallback(() => setRecenterKey((n) => n + 1), []);

  const enter = async (mode: 'ar' | 'vr') => {
    setEnterError('');
    try {
      if (mode === 'ar') await store.enterAR();
      else await store.enterVR();
    } catch {
      setEnterError('The headset didn’t start the session. Check the browser’s permission prompt and try again.');
    }
  };

  return (
    <div className="rx-root">
      <header className="rx-head">
        <div>
          <p className="rx-eyebrow">Recipe Reborn · Hands-free kitchen · WebXR</p>
          <h1>{recipe.title}</h1>
          {recipe.isSample && <p className="rk-badge rx-badge">Sample recipe · demo data — no account needed</p>}
        </div>
        <div className="rx-enter">
          {support.ar && (
            <button className="rk-btn rk-btn-primary" disabled={inSession} onClick={() => enter('ar')}>
              Enter passthrough (see your kitchen)
            </button>
          )}
          {support.vr && (
            <button className={`rk-btn${support.ar ? '' : ' rk-btn-primary'}`} disabled={inSession} onClick={() => enter('vr')}>
              Enter VR
            </button>
          )}
          <div className="rx-row">
            <button className="rk-btn" aria-pressed={layout === 'standing'} onClick={() => setLayout('standing')}>
              Standing
            </button>
            <button className="rk-btn" aria-pressed={layout === 'seated'} onClick={() => setLayout('seated')}>
              Seated
            </button>
          </div>
          <small className="rk-muted">
            {!support.checked
              ? 'Checking for a headset…'
              : support.ar || support.vr
                ? 'Put the controllers down after entering: pinch or poke with your hands.'
                : 'Open this page in the Meta Quest Browser to cook in passthrough. You can try the same panels here with a mouse.'}
          </small>
          {enterError && <p className="rk-toast">{enterError}</p>}
        </div>
      </header>

      <div className="rx-stage">
        <Boundary>
          <Canvas events={noEvents} dpr={[1, 1.5]} camera={{ fov: 55, near: 0.02, far: 50 }} gl={{ antialias: true, alpha: true }}>
            <PointerEvents />
            <XR store={store}>
              <PreviewCamera layout={layout} />
              <Suspense fallback={null}>
                <KitchenScene k={k} layout={layout} setLayout={setLayout} recenterKey={recenterKey} onRecenter={onRecenter} />
              </Suspense>
            </XR>
          </Canvas>
        </Boundary>
      </div>

      <section className="rx-help">
        <div>
          <h2>Hands first — no controllers needed</h2>
          <ul>
            <li>
              <strong>Poke</strong> a button with your fingertip, or <strong>pinch</strong> while pointing at it.
            </li>
            <li>
              <strong>Next step / Back / Repeat</strong> sit under the step. Repeat reads the step aloud.
            </li>
            <li>
              <strong>Ingredients</strong> (left): poke a row to check it off. Rows used in this step glow yellow.
            </li>
            <li>
              <strong>Timers</strong> (right): start one from the step, or +1 / +5 / +10 min. Several can run at once.
            </li>
            <li>
              <strong>Seated</strong> pulls everything within arm’s reach; <strong>Recenter</strong> moves it in front of you.
            </li>
          </ul>
        </div>
        <div>
          <h2>Optional: voice</h2>
          <p className="rk-muted">
            {KITCHEN_HELP} On Quest, speech is recognised on the headset itself; the first start downloads a 29 MB model.
          </p>
          <div className="rx-row">
            <button
              className="rk-btn"
              disabled={k.voice === 'unsupported'}
              aria-pressed={k.voice === 'listening' || k.voice === 'loading'}
              onClick={k.toggleVoice}
            >
              {k.voice === 'listening' ? '● Listening — tap to stop' : k.voice === 'loading' ? '◌ Loading voice…' : '🎙 Turn on voice'}
            </button>
            <Link className="rk-btn" href={`/kitchen/${recipe.id}`}>
              Screen kitchen mode
            </Link>
            <Link className="rk-btn rk-btn-quiet" href={exitHref}>
              Exit
            </Link>
          </div>
          {(k.voiceNote || k.toast) && (
            <p className="rk-muted" role="status">
              {k.toast || k.voiceNote}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
