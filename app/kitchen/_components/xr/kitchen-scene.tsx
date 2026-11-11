'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Group, Vector3 } from 'three';
import { detectTimers, formatClock, ingredientsForStep, timeLeft } from '@/lib/kitchen/engine';
import type { KitchenController } from '@/lib/kitchen/use-kitchen';
import { Button3D, CheckRow3D, Label, Panel, ui } from './ui3d';

export type XRLayout = 'standing' | 'seated';

/**
 * The in-headset kitchen: a floating step panel with big Back / Repeat / Next
 * buttons, an ingredient checklist on the left and timers on the right.
 *
 * Everything is sized for hands: buttons are at least 4 cm tall so a fingertip
 * poke lands reliably, and the seated layout pulls the panels in to ~45 cm and
 * tilts them up so they stay within arm's reach without leaning forward.
 */

const LAYOUTS: Record<XRLayout, { distance: number; drop: number; tilt: number; spread: number; yaw: number }> = {
  // Standing at a counter: a comfortable glance down, about a forearm-and-a-half away.
  standing: { distance: 0.62, drop: 0.28, tilt: -0.12, spread: 0.47, yaw: 0.5 },
  // Seated (or stationary): closer, lower and tilted up like a lectern, all within poke reach.
  seated: { distance: 0.46, drop: 0.3, tilt: -0.38, spread: 0.47, yaw: 0.62 },
};

const ING_PER_PAGE = 8;

// Places the panels in front of the user whenever a session starts, the layout changes, or they press Recenter.
function useRecenter(root: React.RefObject<Group | null>, key: string, layout: XRLayout) {
  const session = useXR((s) => s.session);
  const { gl, camera } = useThree();
  const pending = useRef(0);
  const tmp = useMemo(() => ({ p: new Vector3(), f: new Vector3() }), []);
  useEffect(() => {
    pending.current = session ? 20 : 0;
    if (!session && root.current) {
      root.current.position.set(0, 1.25, -LAYOUTS[layout].distance);
      root.current.rotation.set(0, 0, 0);
    }
  }, [session, key, layout, root]);
  useFrame(() => {
    if (!pending.current || !root.current) return;
    if (--pending.current > 0) return;
    const cam = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    cam.getWorldPosition(tmp.p);
    cam.getWorldDirection(tmp.f);
    tmp.f.y = 0;
    if (tmp.f.lengthSq() < 1e-4) tmp.f.set(0, 0, -1);
    tmp.f.normalize();
    const L = LAYOUTS[layout];
    root.current.position.copy(tmp.p).addScaledVector(tmp.f, L.distance);
    root.current.position.y = tmp.p.y - L.drop;
    root.current.rotation.set(0, Math.atan2(-tmp.f.x, -tmp.f.z), 0);
  });
}

function StepPanel({ k }: { k: KitchenController }) {
  const { state, recipe } = k;
  const step = recipe.steps[state.step] ?? '';
  const uses = ingredientsForStep(recipe.ingredients, step).map((i) => recipe.ingredients[i]);
  const timers = detectTimers(step).slice(0, 2);
  const W = 0.6;
  const H = 0.4;
  const last = state.step >= state.total - 1;
  // Big text for short steps, stepping down so long steps still fit above the buttons.
  const stepSize = state.finished ? 0.04 : step.length <= 90 ? 0.036 : step.length <= 170 ? 0.03 : 0.024;
  return (
    <Panel w={W} h={H}>
      <Label position={[-W / 2 + 0.03, H / 2 - 0.025, 0]} size={0.016} color={ui.accent} bold letterSpacing={0.08}>
        {state.finished ? 'ALL STEPS DONE' : `STEP ${state.step + 1} OF ${state.total}`}
      </Label>
      <Label position={[W / 2 - 0.03, H / 2 - 0.025, 0]} size={0.013} color={ui.muted} anchorX="right" maxWidth={0.3}>
        {recipe.title}
      </Label>
      <Label position={[-W / 2 + 0.03, H / 2 - 0.06, 0]} size={stepSize} bold maxWidth={W - 0.06} lineHeight={1.22}>
        {state.finished ? 'Enjoy your meal!' : step}
      </Label>
      {!state.finished && uses.length > 0 && (
        <Label position={[-W / 2 + 0.03, -H / 2 + 0.135, 0]} size={0.0155} color={ui.amount} maxWidth={W - 0.06} anchorY="bottom">
          {`Uses: ${uses.join(' · ')}`}
        </Label>
      )}
      {!state.finished &&
        timers.map((t, i) => (
          <Button3D
            key={`${state.step}-${i}`}
            w={0.2}
            h={0.042}
            size={0.015}
            warn
            label={`Start ${t.label} timer`}
            position={[-W / 2 + 0.13 + i * 0.215, -H / 2 + 0.1, 0.002]}
            onPress={() => k.startTimer(`Step ${state.step + 1}: ${t.label}`, t.ms, state.step)}
          />
        ))}
      <Button3D w={0.15} h={0.06} size={0.022} label="Back" position={[-0.205, -H / 2 + 0.042, 0.002]} disabled={state.step === 0 && !state.finished} onPress={k.back} />
      <Button3D w={0.15} h={0.06} size={0.022} label="Repeat" position={[-0.045, -H / 2 + 0.042, 0.002]} disabled={state.finished} onPress={k.repeat} />
      {state.finished ? (
        <Button3D w={0.24} h={0.06} size={0.022} primary label="Start over" position={[0.16, -H / 2 + 0.042, 0.002]} onPress={k.restart} />
      ) : (
        <Button3D w={0.24} h={0.06} size={0.024} primary label={last ? 'Finish' : 'Next step'} position={[0.16, -H / 2 + 0.042, 0.002]} onPress={k.next} />
      )}
    </Panel>
  );
}

function IngredientsPanel({ k }: { k: KitchenController }) {
  const { recipe, state } = k;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(recipe.ingredients.length / ING_PER_PAGE));
  const used = new Set(ingredientsForStep(recipe.ingredients, recipe.steps[state.step] ?? ''));
  const start = page * ING_PER_PAGE;
  const W = 0.36;
  const H = 0.5;
  const done = state.checked.filter(Boolean).length;
  return (
    <Panel w={W} h={H}>
      <Label position={[-W / 2 + 0.02, H / 2 - 0.02, 0]} size={0.016} color={ui.accent} bold letterSpacing={0.08}>
        INGREDIENTS
      </Label>
      <Label position={[W / 2 - 0.02, H / 2 - 0.022, 0]} size={0.013} color={ui.muted} anchorX="right">
        {`${done} / ${recipe.ingredients.length} ready`}
      </Label>
      {recipe.ingredients.slice(start, start + ING_PER_PAGE).map((ing, j) => {
        const i = start + j;
        return (
          <CheckRow3D
            key={i}
            w={W - 0.03}
            h={0.041}
            label={ing}
            checked={state.checked[i]}
            highlight={used.has(i) && !state.checked[i]}
            position={[0, H / 2 - 0.07 - j * 0.046, 0.002]}
            onToggle={() => k.toggleIngredient(i)}
          />
        );
      })}
      {pages > 1 && (
        <>
          <Button3D w={0.1} h={0.042} size={0.014} label="Prev" disabled={page === 0} position={[-0.11, -H / 2 + 0.03, 0.002]} onPress={() => setPage((p) => Math.max(0, p - 1))} />
          <Label position={[0, -H / 2 + 0.03, 0]} size={0.013} color={ui.muted} anchorX="center" anchorY="middle">{`${page + 1} / ${pages}`}</Label>
          <Button3D w={0.1} h={0.042} size={0.014} label="More" disabled={page >= pages - 1} position={[0.11, -H / 2 + 0.03, 0.002]} onPress={() => setPage((p) => Math.min(pages - 1, p + 1))} />
        </>
      )}
    </Panel>
  );
}

function TimersPanel({ k }: { k: KitchenController }) {
  const { state, now } = k;
  const W = 0.36;
  const H = 0.46;
  const shown = state.timers.slice(-4);
  return (
    <Panel w={W} h={H} border={k.alarming ? ui.warn : ui.line}>
      <Label position={[-W / 2 + 0.02, H / 2 - 0.02, 0]} size={0.016} color={ui.accent} bold letterSpacing={0.08}>
        TIMERS
      </Label>
      {shown.length === 0 && (
        <Label position={[-W / 2 + 0.02, H / 2 - 0.06, 0]} size={0.014} color={ui.muted} maxWidth={W - 0.04}>
          No timers yet. Poke a step’s timer button, or add one below.
        </Label>
      )}
      {shown.map((t, j) => {
        const y = H / 2 - 0.08 - j * 0.078;
        const done = t.status === 'done';
        return (
          <group key={t.id} position={[0, y, 0.002]}>
            <Panel w={W - 0.03} h={0.07} color={done ? ui.warnBg : ui.raised} border={done ? ui.warn : ui.line}>
              <Label position={[-(W - 0.03) / 2 + 0.012, 0.028, 0]} size={0.0115} color={ui.muted} maxWidth={0.2}>
                {t.label}
              </Label>
              <Label position={[-(W - 0.03) / 2 + 0.012, -0.004, 0]} size={0.027} bold anchorY="middle" color={done ? ui.amount : ui.text}>
                {done ? 'Done!' : formatClock(timeLeft(t, now))}
              </Label>
              {t.status === 'running' && <Button3D w={0.062} h={0.04} size={0.012} label="Pause" position={[0.035, -0.008, 0.002]} onPress={() => k.pauseTimer(t.id)} />}
              {t.status === 'paused' && <Button3D w={0.062} h={0.04} size={0.012} label="Resume" position={[0.035, -0.008, 0.002]} onPress={() => k.resumeTimer(t.id)} />}
              {done && <Button3D w={0.062} h={0.04} size={0.012} label="+1 min" position={[0.035, -0.008, 0.002]} onPress={() => k.addMinute(t.id)} />}
              <Button3D w={0.062} h={0.04} size={0.012} warn={done} label={done ? 'Dismiss' : 'Cancel'} position={[0.103, -0.008, 0.002]} onPress={() => k.cancelTimer(t.id)} />
            </Panel>
          </group>
        );
      })}
      <Label position={[-W / 2 + 0.02, -H / 2 + 0.075, 0]} size={0.012} color={ui.muted}>
        ADD A TIMER
      </Label>
      {[1, 5, 10].map((m, i) => (
        <Button3D key={m} w={0.1} h={0.044} size={0.015} label={`+${m} min`} position={[-0.11 + i * 0.11, -H / 2 + 0.035, 0.002]} onPress={() => k.startTimer(`${m} min timer`, m * 60_000)} />
      ))}
    </Panel>
  );
}

function Toolbar({
  k,
  layout,
  setLayout,
  onRecenter,
  onExit,
}: {
  k: KitchenController;
  layout: XRLayout;
  setLayout: (l: XRLayout) => void;
  onRecenter: () => void;
  onExit: (() => void) | null;
}) {
  const W = 0.6;
  const H = 0.075;
  const voiceOn = k.voice === 'listening' || k.voice === 'loading';
  const status =
    k.toast ||
    (k.heard ? `Heard “${k.heard}”` : '') ||
    k.voiceNote ||
    (k.voice === 'unsupported' ? 'Everything works with your hands: poke or pinch the buttons.' : 'Poke or pinch any button. Voice is optional.');
  return (
    <Panel w={W} h={H}>
      <Button3D w={0.1} h={0.044} size={0.0135} label="Standing" active={layout === 'standing'} position={[-0.24, 0.006, 0.002]} onPress={() => setLayout('standing')} />
      <Button3D w={0.1} h={0.044} size={0.0135} label="Seated" active={layout === 'seated'} position={[-0.135, 0.006, 0.002]} onPress={() => setLayout('seated')} />
      <Button3D w={0.1} h={0.044} size={0.0135} label="Recenter" position={[-0.03, 0.006, 0.002]} onPress={onRecenter} />
      <Button3D
        w={0.1}
        h={0.044}
        size={0.0135}
        label={k.voice === 'loading' ? 'Loading…' : voiceOn ? 'Voice on' : 'Voice'}
        active={voiceOn}
        disabled={k.voice === 'unsupported'}
        position={[0.075, 0.006, 0.002]}
        onPress={k.toggleVoice}
      />
      {onExit && <Button3D w={0.1} h={0.044} size={0.0135} label="Exit" position={[0.18 + 0.065 / 2, 0.006, 0.002]} onPress={onExit} />}
      <Label position={[0, -H / 2 + 0.004, 0]} size={0.0105} color={ui.muted} anchorX="center" anchorY="bottom" maxWidth={W - 0.04}>
        {status}
      </Label>
    </Panel>
  );
}

export default function KitchenScene({
  k,
  layout,
  setLayout,
  recenterKey,
  onRecenter,
}: {
  k: KitchenController;
  layout: XRLayout;
  setLayout: (l: XRLayout) => void;
  recenterKey: number;
  onRecenter: () => void;
}) {
  const root = useRef<Group>(null);
  const session = useXR((s) => s.session);
  const mode = useXR((s) => s.mode);
  useRecenter(root, String(recenterKey), layout);
  const L = LAYOUTS[layout];
  const sideZ = 0.12;
  return (
    <>
      {mode !== 'immersive-ar' && (
        <>
          <color attach="background" args={['#0c1a13']} />
          <gridHelper args={[8, 32, '#1f4a31', '#132a1d']} />
        </>
      )}
      <group ref={root} position={[0, 1.25, -L.distance]}>
        {/* Tilted as one unit so the seated "lectern" keeps every panel in reach. */}
        <group rotation={[L.tilt, 0, 0]}>
          {k.recipe.isSample && (
            <Label position={[0, 0.305, 0]} size={0.013} color={ui.amount} anchorX="center" anchorY="bottom">
              Sample recipe · demo data
            </Label>
          )}
          <group position={[0, 0.25, 0]}>
            <Toolbar k={k} layout={layout} setLayout={setLayout} onRecenter={onRecenter} onExit={session ? () => void session.end() : null} />
          </group>
          <StepPanel k={k} />
          <group position={[-L.spread, 0.03, sideZ]} rotation={[0, L.yaw, 0]}>
            <IngredientsPanel k={k} />
          </group>
          <group position={[L.spread, 0.03, sideZ]} rotation={[0, -L.yaw, 0]}>
            <TimersPanel k={k} />
          </group>
        </group>
      </group>
    </>
  );
}
