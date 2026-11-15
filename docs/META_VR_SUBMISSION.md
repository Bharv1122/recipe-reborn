# Recipe Reborn Kitchen: Meta VR Start Developer Competition kit

Contest: Meta VR Start Developer Competition 2026 on Devpost
(https://start-developer-competition-26.devpost.com/). Entries close
**Wednesday, November 18, 2026 at 12:00 PM Pacific**. Nothing can be changed
after that. Judges test the entry as it stands at the deadline.

## Entry choices

- **Track:** Productivity (a routine-based kitchen tool used every day)
- **Division:** Adapted / Significantly Updated Experience. Recipe Reborn already
  existed as a web and phone app. The new feature, shipped inside the competition
  window, is a hands-first mixed reality mode: a new platform integration and a new
  hand-interaction feature, which are the rule's own examples of a significant update.
- **Build type:** WebXR. Judges get a link instead of an APK.
- **Judge link:** https://recipereborn.com/xr (free, no account, no paywall)

## Project name

Recipe Reborn Kitchen

## Tagline (140 characters max)

> Swap a processed label for the real thing. Cook it with bare hands: floating steps, checklists and timers over your actual kitchen counter.

(139 characters)

## Description (paste into Devpost, about 480 words)

**Inspiration**

Recipe Reborn started as a web and phone app that reads a packaged food's
ingredient label and generates a fresh, homemade version. People loved the
before-and-after, but the moment they actually started cooking, the phone
became the problem. Hands are covered in flour or raw egg, the screen locks,
the recipe scrolls away, and a timer lives in a different app. A headset with
passthrough and hand tracking fixes exactly that: the recipe can float beside
the stove and be operated with a fingertip or a pinch, no washing up first.

**What it does**

Recipe Reborn Kitchen is a seated, hands-only mixed reality cooking assistant
in the Meta Quest browser.

1. **Pick what you are replacing.** Three packaged foods (boxed mac and cheese,
   an instant ramen cup, a chewy granola bar) appear as cards.
2. **See the label next to your kitchen.** The additives most people would not
   keep at home are crossed out one by one as the fresh recipe fades in.
3. **Gather ingredients.** A checklist panel to your left. Poke each item as it
   lands on the counter.
4. **Cook step by step.** The current step is large in front of you, with Back,
   Read aloud and Next. Steps that need time offer a one-pinch timer.
5. **Timers on your right** keep running on wall-clock time, even through the
   system menu or taking the headset off, then chime and flash when done.
6. **Wrist card.** Turn your left palm toward your face and a small card shows
   the current step and the nearest timer, with a Next button you can poke with
   your other hand.

Everything works without controllers. Pinch to tap with the system pinch ray,
poke buttons directly with an index fingertip, and pinch and hold any panel's
top bar to move it closer to the stove. Every press gives an audio click,
because bare hands have no haptics. The session resumes where you left off.

**How we built it**

The XR mode is a Next.js route on the existing Recipe Reborn site, built with
three.js and WebXR (`immersive-ar` passthrough with an `immersive-vr`
fallback, the `hand-tracking` feature and a seated `local` reference space).
UI panels are canvas textures that only repaint when something changes, which
keeps the scene to a handful of draw calls. Fingertip poke uses the
`index-finger-tip` joint with a press depth and cooldown, and the wrist card
uses the wrist joint's palm normal with hysteresis so it does not flicker. We
tested the full hands-only flow (pinch, poke, drag, wrist card) in Meta's
Immersive Web Emulator emulating a Quest 3.

**New in the competition window**

The whole mixed reality mode is new: the `/xr` route, the hands-first panels,
fingertip poke, pinch-and-hold panel moving, wall-clock timers, the palm-up
wrist card and the label-versus-fresh reveal.

**What's next**

Bring the user's own saved Recipe Reborn recipes and fresh AI generations into
the kitchen, anchor panels to the real counter with plane detection, and add
voice commands for "next" and "start timer".

**Target launch date:** [CONFIRM] Live now on the open web at recipereborn.com/xr.
Meta Horizon Store listing planned for Q1 2027.

## Optional: hand interaction notes (for the form's hand-tracking field)

Pinch: the WebXR target ray of each tracked hand plus `selectstart` and
`selectend`. A press fires on release only if the ray is still on the same
button, so a pinch that drifts does not mis-fire. Poke: the index fingertip
must cross from in front of the panel to within 12 mm of it, with a 450 ms
cooldown. Move: pinch and hold a panel's grip bar, and the panel follows the
hand, then turns to face you. Wrist card: shown when the left palm faces the
head (dot product over 0.7, hidden under 0.45).

## Demo video (under 3 minutes, public on YouTube or Vimeo)

Record on a Quest 3 if you have one: open recipereborn.com/xr in the Quest
browser, press **Enter mixed reality**, and record with the headset's built-in
capture. If not, the rules allow emulator footage.

- **0:00–0:15** Hook. A messy-handed cook, a phone smeared with flour. Caption:
  "Cooking with a phone means washing your hands every step."
- **0:15–0:35** Put on the headset, open recipereborn.com/xr, Enter mixed
  reality. Panels appear over the real counter.
- **0:35–1:00** Pinch "Boxed mac & cheese". The label's additives get crossed
  out as the fresh recipe fades in.
- **1:00–1:20** Gather ingredients: poke items on the checklist with a fingertip.
- **1:20–1:50** Cook: Next with a pinch, start the pasta timer, Read aloud.
- **1:50–2:10** Pinch and hold a panel's top bar and drag it next to the stove.
- **2:10–2:30** Turn the left palm up: the wrist card shows the step and the
  timer. Poke Next on the wrist.
- **2:30–2:50** Timer chimes. Finish: "Dinner, reborn." with confetti.
- **2:50–2:58** Caption: "Recipe Reborn Kitchen. Hands only. recipereborn.com/xr"

Keep it under 3:00. No music you do not have rights to, no other brands or
logos in frame, no other identifiable people unless they are on the entry.

## Rule-compliance checklist

- [x] VR/MR app for Meta Quest, built with public tools (three.js, WebXR)
- [x] Fully usable with hands only. Controllers also work but are never needed
- [x] Seated, quick to enter and exit, satisfying in under 10 minutes
- [x] Free, no login and no paywall for judges
- [x] No third-party brands, logos or ads. Products are generic
- [x] Original work, not a wrapper around a third-party service
- [x] English throughout
- [ ] Link stays live until winners are announced (around December 11)
- [ ] Entrant is a Meta VR Start Program member with Developer Access on
- [ ] Demo video under 3 minutes, public on YouTube or Vimeo
- [ ] Submitted on Devpost before Wednesday, November 18, 12:00 PM PT
