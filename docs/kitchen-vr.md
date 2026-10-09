# Hands-free kitchen mode (screen + WebXR)

Two surfaces, one step engine:

| | URL | Who it's for |
| --- | --- | --- |
| Kitchen display | `/kitchen/[recipeId]` | Any tablet, phone or smart display, landscape or portrait |
| WebXR | `/kitchen/[recipeId]/xr` | Meta Quest 3/3S/Pro browser (passthrough AR), Quest 2 (VR), other WebXR headsets/glasses |
| **Judge demo (no login)** | **`/kitchen/demo`** and **`/kitchen/demo/xr`** | Sample recipe (Weeknight Tomato Soup), clearly labelled "Sample recipe · demo data" |

`recipeId` can be a house catalog id (public, e.g. `rr-simple-marinara`) or a user's saved recipe id
(requires login and ownership — same rule as `/cooking-mode/[id]`; logged-out visitors go to
`/login` and come back).

## How it's built

- `lib/kitchen/engine.ts` — pure step engine shared by both surfaces: next/back/goto/repeat,
  ingredient checklist, multiple timers (absolute end times, pause/resume/+1 min/cancel, capped at 6),
  timer detection from step text ("simmer for 20 minutes"), amount highlighting, per-step ingredient
  matching, voice command parsing. Tested by `npm run verify:kitchen-engine`.
- `lib/kitchen/use-kitchen.ts` — React hook: ticking timers, repeating alarm (beep + vibrate +
  screen flash), read-aloud (speechSynthesis), optional voice.
- `lib/kitchen/voice.ts` + `voice-local.ts` — ported from Hardware Anatomy Lab (`src/xr/voice*.ts`):
  Web Speech where available, otherwise **on-device Vosk** (Quest Browser has no Web Speech).
  The 29 MB model (`public/voice/`, Apache 2.0) downloads only when voice is first turned on;
  audio never leaves the device.
- `lib/kitchen/use-wake-lock.ts` — Screen Wake Lock; rejection is expected and just reported.
- `app/kitchen/_components/xr/` — `@react-three/fiber` + `@react-three/xr` v6 + drei `Text`.
  `ui3d.tsx` is HAL's Panel/Label/Button3D kit in the kitchen palette. Loaded only via
  `next/dynamic({ ssr: false })` on the `/xr` route — three.js never ships to other pages.
- `proxy.ts` — only change to a shared file: `/kitchen/*` responses send `microphone=(self)` in
  Permissions-Policy (every other page still sends `microphone=()`), otherwise voice can't start.

## Meta Start Developer Competition fit (deadline Nov 18 2026)

- **Fully usable with hands alone:** every control is a 3D button that responds to a fingertip
  **poke** or a **pinch** at a distance (ray). No controller, no voice required. Buttons are ≥4 cm.
- **Passthrough first:** "Enter passthrough" (immersive-ar) is offered when supported, so you see
  your real counter and pot through the panels; VR is the fallback.
- **Seated / stationary layout:** the "Seated" toggle pulls panels to ~46 cm and tilts them up like a
  lectern so everything is within arm's reach without leaning. "Recenter" re-places them in front of you.
- Voice is optional (on-device on Quest).

## Recording the < 3 min demo video

Record on a Quest 3 (or 3S) — its passthrough is what judges want to see.

**Before recording**

1. Deploy the branch (or use a Vercel preview URL) — WebXR needs HTTPS.
2. On the Quest: Settings → Camera → Recording: 1080p, 16:9 if offered, **turn microphone on**
   if you'll narrate. Hand tracking on (Settings → Movement tracking → Hand tracking, auto-switch on).
3. Real props on the counter: a pot, an onion, a can of tomatoes, a wooden spoon. Good lighting helps passthrough.
4. Open **Meta Quest Browser → `https://<deploy>/kitchen/demo/xr`**. Turn voice on once
   beforehand so the 29 MB model is already cached (otherwise the first start waits for the download).

**Shot list (target ~2:30)**

| Time | Shot |
| --- | --- |
| 0:00–0:15 | Title card or voice-over: "Recipe Reborn turns packaged foods into homemade recipes. Here's cooking one hands-free on Quest." Show a can of condensed soup next to the fresh ingredients. |
| 0:15–0:30 | Tap **Enter passthrough**. Put the controllers down. Panels appear over the real counter. |
| 0:30–1:00 | **Poke** ingredients to check them off (yellow rows = used in this step). Poke **Next step**. |
| 1:00–1:25 | On "cook for 5 minutes": poke **Start 5 minutes timer**; add **+1 min** on another; show two timers running. |
| 1:25–1:45 | **Pinch** from a distance (ray) to hit **Next step** while holding a spoon in the other hand. |
| 1:45–2:05 | Sit down, poke **Seated** → panels come within reach. Poke **Recenter**. |
| 2:05–2:25 | Optional: say "next", "start timer five minutes", "repeat" (voice on). Show the timer alarm. |
| 2:25–2:40 | Take off the headset / cut to the same recipe in screen kitchen mode on a tablet (`/kitchen/demo`). End card: recipereborn.com. |

Tips: move your head slowly (recordings exaggerate motion); keep panels in the centre of view;
trim in any editor; export H.264 MP4 under 3:00. Say out loud that controllers are not used.

## Verified vs. not verified (2026-09-30)

Verified here:

- ✅ `npm run verify:kitchen-engine`, `npx tsc --noEmit`, `npm run build` pass; lint shows no issues in new files.
- ✅ Headless Chromium (SwiftShader) screenshots of kitchen mode (tablet landscape + portrait, phone,
  phone ingredient sheet) and the XR page (standing, seated, phone) — in `docs/screenshots/`.
- ✅ In the XR page preview, mouse clicks on the 3D panels (the same pointer-event path XR pinch/poke use)
  advanced the step, checked an ingredient and started a timer (`kitchen-xr-interaction.png`).
- ✅ Logged-out visitors to a saved-recipe kitchen URL are sent to `/login?callbackUrl=…`.
- ✅ three.js / Vosk chunks are not in any page's initial JS; they load only on `/xr` or when voice is turned on.

Not verified (needs a real device):

- ⚠️ **Not tested on a Quest headset**: entering immersive-ar/vr, hand poke/pinch in a session,
  passthrough look, on-device voice on Quest. The sandbox has no WebXR device.
- ⚠️ `?emulate=1` (HAL's Meta Quest emulator switch) loads, but in headless Chromium it still reported
  no XR support, so the Enter buttons didn't appear there. Untested in a desktop Chrome window.
- ⚠️ Wake lock, TTS and Web Speech need a real browser with a user gesture; code paths tolerate refusal.
- ⚠️ The timer alarm sound was not heard (headless).
