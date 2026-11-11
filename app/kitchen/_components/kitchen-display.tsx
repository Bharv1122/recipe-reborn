'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  detectTimers,
  formatClock,
  ingredientsForStep,
  splitAmounts,
  timeLeft,
  type KitchenRecipe,
} from '@/lib/kitchen/engine';
import { useKitchen, type KitchenController } from '@/lib/kitchen/use-kitchen';
import { useWakeLock } from '@/lib/kitchen/use-wake-lock';
import '../kitchen.css';

const QUICK_TIMERS = [1, 5, 10, 15, 30];

function StepText({ text }: { text: string }) {
  return (
    <>
      {splitAmounts(text).map((seg, i) =>
        seg.amount ? (
          <mark key={i} className="rk-amount">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

function Timers({ k }: { k: KitchenController }) {
  const { state, now } = k;
  return (
    <section className="rk-panel" aria-label="Timers">
      <h2 className="rk-panel-title">Timers</h2>
      {state.timers.length === 0 && <p className="rk-muted">No timers running. Start one from a step or below.</p>}
      <ul className="rk-timers">
        {state.timers.map((t) => (
          <li key={t.id} className={`rk-timer is-${t.status}`}>
            <div className="rk-timer-head">
              <span className="rk-timer-label">{t.label}</span>
              <span className="rk-timer-clock" aria-live={t.status === 'done' ? 'assertive' : 'off'}>
                {t.status === 'done' ? 'Done!' : formatClock(timeLeft(t, now))}
              </span>
            </div>
            <div className="rk-timer-actions">
              {t.status === 'running' && (
                <button className="rk-btn" onClick={() => k.pauseTimer(t.id)}>
                  Pause
                </button>
              )}
              {t.status === 'paused' && (
                <button className="rk-btn" onClick={() => k.resumeTimer(t.id)}>
                  Resume
                </button>
              )}
              <button className="rk-btn" onClick={() => k.addMinute(t.id)}>
                +1 min
              </button>
              <button className="rk-btn rk-btn-quiet" onClick={() => k.cancelTimer(t.id)}>
                {t.status === 'done' ? 'Dismiss' : 'Cancel'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="rk-quick" role="group" aria-label="Add a timer">
        {QUICK_TIMERS.map((m) => (
          <button key={m} className="rk-chip" onClick={() => k.startTimer(`${m} min timer`, m * 60_000)}>
            + {m} min
          </button>
        ))}
      </div>
    </section>
  );
}

function Ingredients({ k, highlight }: { k: KitchenController; highlight: Set<number> }) {
  return (
    <section className="rk-panel" aria-label="Ingredients">
      <h2 className="rk-panel-title">
        Ingredients <span className="rk-muted">· tap to check off</span>
      </h2>
      <ul className="rk-ingredients">
        {k.recipe.ingredients.map((ing, i) => (
          <li key={i}>
            <button
              className={`rk-ingredient${k.state.checked[i] ? ' is-checked' : ''}${highlight.has(i) ? ' is-used' : ''}`}
              aria-pressed={k.state.checked[i]}
              onClick={() => k.toggleIngredient(i)}
            >
              <span className="rk-check" aria-hidden>
                {k.state.checked[i] ? '✓' : ''}
              </span>
              <span>
                <StepText text={ing} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function KitchenDisplay({ recipe, exitHref }: { recipe: KitchenRecipe; exitHref: string }) {
  const [showIngredients, setShowIngredients] = useState(false);
  const k = useKitchen(recipe, { onShowIngredients: () => setShowIngredients(true) });
  const wake = useWakeLock(true);
  const { state } = k;
  const step = recipe.steps[state.step] ?? '';
  const used = useMemo(() => new Set(ingredientsForStep(recipe.ingredients, step)), [recipe.ingredients, step]);
  const stepTimers = useMemo(() => detectTimers(step), [step]);

  // Keyboard: → / space next, ← back, R repeat, I ingredients.
  const kRef = useRef(k);
  kRef.current = k;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        kRef.current.next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') kRef.current.back();
      else if (e.key === 'r' || e.key === 'R') kRef.current.repeat();
      else if (e.key === 'i' || e.key === 'I') setShowIngredients((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Swipe left/right on the step card.
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const voiceLabel = k.voice === 'listening' ? 'Listening' : k.voice === 'loading' ? 'Loading voice…' : 'Voice commands';

  return (
    <div className={`rk-root${k.alarming ? ' is-alarming' : ''}`}>
      <header className="rk-top">
        <Link href={exitHref} className="rk-btn rk-btn-quiet" aria-label="Exit kitchen mode">
          ✕ Exit
        </Link>
        <div className="rk-title">
          <h1>{recipe.title}</h1>
          <p className="rk-meta">
            {recipe.isSample && <span className="rk-badge">Sample recipe · demo data</span>}
            {recipe.servings && <span>Serves {recipe.servings}</span>}
            {recipe.prepTime && <span className="rk-hide-small">Prep {recipe.prepTime}</span>}
            {recipe.cookTime && <span className="rk-hide-small">Cook {recipe.cookTime}</span>}
          </p>
        </div>
        <div className="rk-tools">
          {k.ttsSupported && (
            <button className="rk-btn" aria-pressed={k.readAloud} aria-label="Read steps aloud" onClick={k.toggleReadAloud}>
              {k.readAloud ? '🔊' : '🔈'}
              <span className="rk-hide-small">{k.readAloud ? 'Reading aloud' : 'Read aloud'}</span>
            </button>
          )}
          {k.voice !== 'unsupported' && (
            <button
              className="rk-btn"
              aria-pressed={k.voice === 'listening' || k.voice === 'loading'}
              aria-label="Voice commands"
              onClick={k.toggleVoice}
            >
              {k.voice === 'listening' ? '●' : k.voice === 'loading' ? '◌' : '🎙'}
              <span className="rk-hide-small">{voiceLabel}</span>
            </button>
          )}
          <button className="rk-btn rk-only-portrait" aria-expanded={showIngredients} onClick={() => setShowIngredients((v) => !v)}>
            🧺 Ingredients
          </button>
          <Link href={`/kitchen/${recipe.id}/xr`} className="rk-btn" aria-label="Open in VR or passthrough AR">
            🥽 <span className="rk-hide-small">VR / AR</span>
          </Link>
        </div>
      </header>

      <div className="rk-progress" role="progressbar" aria-valuemin={1} aria-valuemax={state.total} aria-valuenow={state.step + 1}>
        {recipe.steps.map((_, i) => (
          <button
            key={i}
            className={`rk-dot${i === state.step && !state.finished ? ' is-current' : ''}${i < state.step || state.finished ? ' is-done' : ''}`}
            aria-label={`Go to step ${i + 1}`}
            onClick={() => k.goto(i)}
          />
        ))}
      </div>

      <div className="rk-body">
        <main
          className="rk-stage"
          onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 80 && Math.abs(dx) > 2 * Math.abs(e.clientY - s.y)) {
              if (dx < 0) k.next();
              else k.back();
            }
          }}
        >
          {recipe.steps.length === 0 ? (
            <p className="rk-step">This recipe has no steps yet.</p>
          ) : state.finished ? (
            <div className="rk-finished">
              <p className="rk-step-count">All steps done</p>
              <p className="rk-step">Enjoy your meal! 🎉</p>
              <div className="rk-row">
                <button className="rk-btn rk-btn-big" onClick={k.restart}>
                  ↺ Start over
                </button>
                <Link className="rk-btn rk-btn-big" href={exitHref}>
                  Exit
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="rk-step-count" aria-live="polite">
                Step {state.step + 1} <span className="rk-muted">of {state.total}</span>
              </p>
              <p className="rk-step" key={`${state.step}-${state.repeatNonce}`}>
                <StepText text={step} />
              </p>
              {used.size > 0 && (
                <ul className="rk-uses" aria-label="Ingredients for this step">
                  {Array.from(used).map((i) => (
                    <li key={i}>
                      <StepText text={recipe.ingredients[i]} />
                    </li>
                  ))}
                </ul>
              )}
              {stepTimers.length > 0 && (
                <div className="rk-row">
                  {stepTimers.map((t, i) => (
                    <button
                      key={i}
                      className="rk-btn rk-btn-timer"
                      onClick={() => k.startTimer(`Step ${state.step + 1}: ${t.label}`, t.ms, state.step)}
                    >
                      ⏱ Start {t.label} timer
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {(k.toast || k.heard) && (
            <p className="rk-toast" role="status">
              {k.toast || `Heard “${k.heard}”`}
            </p>
          )}
          {k.voiceNote && <p className="rk-muted rk-small">{k.voiceNote}</p>}
        </main>

        <aside className={`rk-side${showIngredients ? ' is-open' : ''}`}>
          <button className="rk-btn rk-btn-primary rk-close" onClick={() => setShowIngredients(false)}>
            Back to the step
          </button>
          <Timers k={k} />
          <Ingredients k={k} highlight={used} />
        </aside>
      </div>

      <nav className="rk-nav" aria-label="Step controls">
        <button className="rk-btn rk-btn-big" onClick={k.back} disabled={state.step === 0 && !state.finished}>
          ← Back
        </button>
        <button className="rk-btn rk-btn-big" onClick={k.repeat} disabled={state.finished}>
          ↻ Repeat
        </button>
        <button className="rk-btn rk-btn-big rk-btn-primary" onClick={k.next} disabled={state.finished}>
          {state.step >= state.total - 1 ? 'Finish ✓' : 'Next →'}
        </button>
      </nav>
      <p className="rk-foot rk-muted">
        Screen {wake === 'on' ? 'stays on while cooking' : wake === 'unsupported' ? 'may dim — this browser can’t keep it awake' : wake === 'denied' ? 'may dim — keep-awake was refused' : 'will stay on after your first tap'}
        {' · '}Keys: ← → R I
      </p>
    </div>
  );
}
