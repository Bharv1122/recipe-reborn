/**
 * Tests the shared hands-free cooking engine (kitchen display + WebXR).
 *
 *   npm run verify:kitchen-engine
 */
import assert from 'node:assert/strict';
import {
  MAX_TIMERS,
  detectTimers,
  formatClock,
  ingredientsForStep,
  initKitchenState,
  kitchenReducer,
  newlyFinished,
  parseKitchenCommand,
  splitAmounts,
  timeLeft,
} from '../lib/kitchen/engine';
import { catalogToKitchenRecipe } from '../lib/kitchen/recipes';
import { DEMO_RECIPE_ID, PUBLIC_RECIPES, getPublicRecipe } from '../lib/public-recipes';

const demo = catalogToKitchenRecipe(getPublicRecipe('demo')!);
assert.equal(demo.id, DEMO_RECIPE_ID);
assert.equal(demo.isSample, true);

// --- navigation ---
let s = initKitchenState(demo);
assert.equal(s.total, demo.steps.length);
s = kitchenReducer(s, { type: 'back' });
assert.equal(s.step, 0, 'back at step 0 stays put');
for (let i = 0; i < demo.steps.length - 1; i++) s = kitchenReducer(s, { type: 'next' });
assert.equal(s.step, demo.steps.length - 1);
assert.equal(s.finished, false);
s = kitchenReducer(s, { type: 'next' });
assert.equal(s.finished, true, 'next on the last step finishes');
s = kitchenReducer(s, { type: 'next' });
assert.equal(s.finished, true);
s = kitchenReducer(s, { type: 'back' });
assert.equal(s.finished, false, 'back from finished returns to the last step');
assert.equal(s.step, demo.steps.length - 1);
s = kitchenReducer(s, { type: 'goto', step: 99 });
assert.equal(s.step, demo.steps.length - 1, 'goto clamps');
const nonce = s.repeatNonce;
s = kitchenReducer(s, { type: 'repeat' });
assert.equal(s.repeatNonce, nonce + 1);
s = kitchenReducer(s, { type: 'toggleIngredient', index: 2 });
assert.equal(s.checked[2], true);
s = kitchenReducer(s, { type: 'toggleIngredient', index: 999 });
s = kitchenReducer(s, { type: 'restart' });
assert.equal(s.step, 0);
assert.ok(s.checked.every((c) => !c));
const empty = initKitchenState({ steps: [], ingredients: [] });
assert.equal(kitchenReducer(empty, { type: 'next' }), empty, 'empty recipe is a no-op');
console.log('PASS: next/back/goto/repeat/finish/restart and ingredient checklist');

// --- timers ---
const t0 = 1_000_000;
s = initKitchenState(demo);
s = kitchenReducer(s, { type: 'startTimer', label: 'Simmer', ms: 20 * 60_000, now: t0, step: 4 });
s = kitchenReducer(s, { type: 'startTimer', label: 'Onion', ms: 5 * 60_000, now: t0 });
assert.equal(s.timers.length, 2, 'multiple timers run at once');
const [simmer, onion] = s.timers;
assert.equal(timeLeft(simmer, t0 + 60_000), 19 * 60_000);
s = kitchenReducer(s, { type: 'pauseTimer', id: simmer.id, now: t0 + 60_000 });
assert.equal(s.timers[0].status, 'paused');
assert.equal(timeLeft(s.timers[0], t0 + 10 * 60_000), 19 * 60_000, 'paused timer does not count down');
s = kitchenReducer(s, { type: 'resumeTimer', id: simmer.id, now: t0 + 10 * 60_000 });
assert.equal(timeLeft(s.timers[0], t0 + 10 * 60_000), 19 * 60_000);
s = kitchenReducer(s, { type: 'addTime', id: simmer.id, ms: 60_000, now: t0 + 10 * 60_000 });
assert.equal(timeLeft(s.timers[0], t0 + 10 * 60_000), 20 * 60_000, '+1 min');
const before = s;
s = kitchenReducer(s, { type: 'tick', now: t0 + 5 * 60_000 + 1 });
assert.equal(s.timers[1].status, 'done', 'onion timer finishes');
assert.equal(s.timers[0].status, 'running');
assert.deepEqual(newlyFinished(before, s), [onion.id]);
assert.equal(kitchenReducer(s, { type: 'tick', now: t0 + 5 * 60_000 + 2 }), s, 'tick without changes keeps identity');
s = kitchenReducer(s, { type: 'addTime', id: onion.id, ms: 60_000, now: t0 + 6 * 60_000 });
assert.equal(s.timers[1].status, 'running', '+1 min on a finished timer restarts it');
s = kitchenReducer(s, { type: 'cancelTimer', id: onion.id });
assert.equal(s.timers.length, 1);
for (let i = 0; i < MAX_TIMERS + 3; i++) s = kitchenReducer(s, { type: 'startTimer', label: `T${i}`, ms: 60_000, now: t0 });
assert.equal(s.timers.length, MAX_TIMERS, 'timer count is capped');
s = kitchenReducer(s, { type: 'startTimer', label: 'huge', ms: 1e12, now: t0 });
assert.ok(s.timers[s.timers.length - 1].durationMs <= 6 * 3_600_000, 'timer length is capped');
assert.equal(formatClock(65_000), '1:05');
assert.equal(formatClock(3_725_000), '1:02:05');
console.log('PASS: multiple timers with pause/resume/+1 min/cancel/finish detection and caps');

// --- step text helpers ---
assert.deepEqual(detectTimers('Simmer for 20 minutes.').map((t) => t.ms), [20 * 60_000]);
assert.deepEqual(detectTimers('Cook 3-4 min per side').map((t) => t.ms), [3 * 60_000], 'range uses the short end');
assert.deepEqual(detectTimers('Bake for an hour, then rest 10 mins').map((t) => t.ms), [3_600_000, 10 * 60_000]);
assert.deepEqual(detectTimers('Stir in 2 cups of broth'), []);
assert.deepEqual(detectTimers('Blend for 2 seconds'), [], 'tiny durations are not timers');
for (const r of PUBLIC_RECIPES) {
  for (const step of r.steps) for (const t of detectTimers(step)) assert.ok(t.ms >= 60_000 && t.ms <= 3_600_000, `${r.id}: ${t.label}`);
}
const soupTimers = demo.steps.flatMap(detectTimers).map((t) => t.label);
assert.deepEqual(soupTimers, ['5 minutes', '1 minute', '20 minutes']);

const seg = splitAmounts('Heat the oven to 350°F and pour 1/4 cup of batter.');
assert.deepEqual(seg.filter((x) => x.amount).map((x) => x.text), ['350°F', '1/4 cup']);
assert.equal(seg.map((x) => x.text).join(''), 'Heat the oven to 350°F and pour 1/4 cup of batter.', 'split is lossless');

const used = ingredientsForStep(demo.ingredients, demo.steps[3]).map((i) => demo.ingredients[i]);
assert.ok(used.some((u) => u.includes('whole tomatoes')));
assert.ok(used.some((u) => u.includes('vegetable broth')));
assert.ok(used.some((u) => u.includes('dried basil')));
assert.ok(!used.some((u) => u.includes('olive oil')), 'olive oil not in step 4');
const oilStep = ingredientsForStep(demo.ingredients, demo.steps[0]).map((i) => demo.ingredients[i]);
assert.deepEqual(oilStep, ['2 tbsp olive oil']);
console.log('PASS: timer detection, amount highlighting and per-step ingredient matching');

// --- voice commands ---
const cmd = (t: string) => parseKitchenCommand(t)?.type ?? null;
assert.equal(cmd('Next'), 'next');
assert.equal(cmd('next step please'), 'next');
assert.equal(cmd('go back'), 'back');
assert.equal(cmd('backstage'), null);
assert.equal(cmd('say that again'), 'repeat');
assert.equal(cmd('what are the ingredients'), 'ingredients');
assert.equal(cmd('stop the timer'), 'stop-timers');
assert.equal(cmd('pause timer'), 'pause-timers');
assert.equal(cmd('resume timer'), 'resume-timers');
assert.equal(cmd('stop listening'), 'stop-listening');
assert.equal(cmd('help'), 'help');
assert.equal(cmd(''), null);
assert.deepEqual(parseKitchenCommand('start timer five minutes'), { type: 'timer', minutes: 5 });
assert.deepEqual(parseKitchenCommand('set a timer for 12 minutes'), { type: 'timer', minutes: 12 });
assert.deepEqual(parseKitchenCommand('start timer'), { type: 'timer', minutes: null });
console.log('PASS: voice command parsing');

console.log('\nAll kitchen engine checks passed.');
