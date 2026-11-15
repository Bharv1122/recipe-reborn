import * as THREE from 'three';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { PALETTE, Panel } from './panel';
import { XR_RECIPES, findXrRecipe, type XrRecipe } from './demo-recipes';

/**
 * Recipe Reborn XR kitchen: a hands-first, seated cooking assistant.
 *
 * Three panels float around the cook: the current step in the middle, the
 * ingredient checklist (and the original processed label) on the left, and
 * running timers on the right. Everything works with bare hands:
 *  - pinch (the system pinch ray) to tap a button,
 *  - poke a button directly with an index fingertip,
 *  - pinch and hold a panel's top bar to move it somewhere handier.
 * Controllers and a desktop mouse drive the same code path, because a
 * controller trigger and a hand pinch both arrive as WebXR "select" events.
 */

type Screen = 'pick' | 'reveal' | 'prep' | 'cook' | 'done';

type Timer = {
  id: string;
  label: string;
  durationMs: number;
  endsAt: number;
  done: boolean;
  stepIndex: number;
};

type SavedState = {
  screen: Screen;
  recipeId: string | null;
  step: number;
  checked: number[];
  timers: Timer[];
  leftTab: 'fresh' | 'label';
};

export type KitchenMode = 'immersive-ar' | 'immersive-vr';

export type KitchenEvents = {
  onSessionChange?: (active: boolean, mode: KitchenMode | null) => void;
  onStateChange?: (summary: string | null) => void;
};

const STORAGE_KEY = 'rr-xr-kitchen-v1';
const POKE_DEPTH = 0.012; // meters in front of the panel that counts as touching
const HOVER_DEPTH = 0.07;
const POKE_COOLDOWN_MS = 450;

function readSaved(): SavedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function minutesLabel(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const m = seconds / 60;
  return Number.isInteger(m) ? `${m} min` : `${m.toFixed(1)} min`;
}

type Pointer = {
  index: number;
  controller: THREE.XRTargetRaySpace;
  hand: THREE.XRHandSpace;
  source: XRInputSource | null;
  line: THREE.Line;
  cursor: THREE.Mesh;
  tip: THREE.Mesh;
  pressTarget: { panel: Panel; id: string; at: number } | null;
  drag: { panel: Panel; offset: THREE.Vector3 } | null;
  lastPokeZ: Map<Panel, number>;
  lastPokeAt: number;
};

export class XrKitchen {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private environment = new THREE.Group();
  private main: Panel;
  private left: Panel;
  private right: Panel;
  private wrist: Panel;
  private wristShown = false;
  private panels: Panel[];
  private confetti: { mesh: THREE.InstancedMesh; velocities: THREE.Vector3[]; positions: THREE.Vector3[]; spins: THREE.Euler[]; start: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private pointers: Pointer[] = [];
  private mouse: { ndc: THREE.Vector2; inside: boolean; pressTarget: { panel: Panel; id: string } | null } = {
    ndc: new THREE.Vector2(),
    inside: false,
    pressTarget: null,
  };
  private session: XRSession | null = null;
  private mode: KitchenMode | null = null;
  private recenterIn = 0;
  private audio: AudioContext | null = null;
  private lastTimerPaint = 0;
  private revealStart = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  // App state
  private screen: Screen = 'pick';
  private recipe: XrRecipe | null = null;
  private step = 0;
  private checked = new Set<number>();
  private timers: Timer[] = [];
  private leftTab: 'fresh' | 'label' = 'fresh';

  constructor(
    private readonly container: HTMLElement,
    private readonly events: KitchenEvents = {},
    /** Draw tracked hand joints even in passthrough (used for emulator capture). */
    private readonly alwaysShowHands = false
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local');
    this.renderer.xr.setFoveation(1);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 50);
    this.camera.position.set(0, -0.1, 0.22);
    this.camera.lookAt(0, -0.16, -0.6);

    this.buildEnvironment();
    this.scene.add(this.root);

    this.main = new Panel('main', 0.58, 0.4, (p) => this.paintMain(p));
    this.left = new Panel('left', 0.36, 0.42, (p) => this.paintLeft(p));
    this.right = new Panel('right', 0.36, 0.42, (p) => this.paintRight(p));
    // A small card that appears on the inside of the left wrist when the cook
    // turns that palm toward their face: the current step and the nearest
    // timer, without looking away from the pan.
    this.wrist = new Panel('wrist', 0.13, 0.085, (p) => this.paintWrist(p), 2400);
    this.wrist.group.visible = false;
    this.scene.add(this.wrist.group);
    this.panels = [this.main, this.left, this.right, this.wrist];
    [this.main, this.left, this.right].forEach((panel) => this.root.add(panel.group));
    this.layoutPanels();

    this.setupPointers();
    this.setupMouse();
    this.restore();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  // ------------------------------------------------------------------ setup

  private buildEnvironment() {
    // Only visible in full VR and the desktop preview. In mixed reality the
    // real kitchen is the environment, so this group is hidden.
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshBasicMaterial({ color: 0x0f2a22 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    this.environment.add(floor);
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.06, 0.7),
      new THREE.MeshBasicMaterial({ color: 0x3b2f25 })
    );
    counter.position.set(0, -0.48, -0.75);
    this.environment.add(counter);
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 64),
      new THREE.MeshBasicMaterial({ color: 0x065f46, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.19;
    this.environment.add(glow);
    this.scene.add(this.environment);
    this.scene.background = new THREE.Color(0x07110e);
    // The panels are unlit, but the hand-joint spheres use a standard material
    // and render black without light.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(0.5, 1, 0.8);
    this.scene.add(key);
  }

  /** Panels sit in an arc at seated arm's reach, a little below eye level. */
  private layoutPanels() {
    const distance = 0.62;
    const height = -0.16;
    const place = (panel: Panel, yawDeg: number, extraDrop = 0) => {
      const yaw = THREE.MathUtils.degToRad(yawDeg);
      panel.group.position.set(Math.sin(yaw) * distance, height - extraDrop, -Math.cos(yaw) * distance);
      panel.group.lookAt(this.root.localToWorld(new THREE.Vector3(0, 0, 0)));
    };
    this.root.updateMatrixWorld(true);
    place(this.main, 0);
    place(this.left, -42, 0.01);
    place(this.right, 42, 0.01);
  }

  private setupPointers() {
    const handFactory = new XRHandModelFactory();
    for (let i = 0; i < 2; i += 1) {
      const controller = this.renderer.xr.getController(i);
      const hand = this.renderer.xr.getHand(i);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.55 })
      );
      line.visible = false;
      controller.add(line);
      const cursor = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xfde68a })
      );
      cursor.visible = false;
      this.scene.add(cursor);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.007, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85 })
      );
      tip.visible = false;
      this.scene.add(tip);

      // Primitive spheres need no downloaded assets; shown only in full VR,
      // because in mixed reality you already see your real hands.
      const handModel = handFactory.createHandModel(hand, 'spheres');
      handModel.userData.isHandModel = true;
      hand.add(handModel);

      const pointer: Pointer = {
        index: i,
        controller,
        hand,
        source: null,
        line,
        cursor,
        tip,
        pressTarget: null,
        drag: null,
        lastPokeZ: new Map(),
        lastPokeAt: 0,
      };
      controller.addEventListener('connected', (event) => {
        pointer.source = event.data;
      });
      controller.addEventListener('disconnected', () => {
        pointer.source = null;
        pointer.drag = null;
        pointer.pressTarget = null;
      });
      controller.addEventListener('selectstart', () => this.onSelectStart(pointer));
      controller.addEventListener('selectend', () => this.onSelectEnd(pointer));
      this.scene.add(controller);
      this.scene.add(hand);
      this.pointers.push(pointer);
    }
  }

  private setupMouse() {
    const el = this.renderer.domElement;
    const toNdc = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      this.mouse.ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
    };
    el.addEventListener('pointermove', (event) => {
      toNdc(event);
      this.mouse.inside = true;
    });
    el.addEventListener('pointerleave', () => {
      this.mouse.inside = false;
    });
    el.addEventListener('pointerdown', (event) => {
      toNdc(event);
      this.mouse.inside = true;
      this.ensureAudio();
      const hit = this.hitFromCamera();
      this.mouse.pressTarget = hit?.button && !hit.button.handle ? { panel: hit.panel, id: hit.button.id } : null;
    });
    el.addEventListener('pointerup', (event) => {
      toNdc(event);
      const hit = this.hitFromCamera();
      const target = this.mouse.pressTarget;
      this.mouse.pressTarget = null;
      if (target && hit?.button && hit.button.id === target.id) this.press(hit.panel, hit.button.id);
    });
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    if (this.renderer.xr.isPresenting) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Pull back on narrow screens so all three panels stay in view.
    this.camera.position.z = w / h < 1.2 ? 1.1 : 0.22;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ sessions

  static async supported(mode: KitchenMode) {
    if (typeof navigator === 'undefined' || !navigator.xr) return false;
    try {
      return await navigator.xr.isSessionSupported(mode);
    } catch {
      return false;
    }
  }

  async enter(mode: KitchenMode) {
    if (!navigator.xr) throw new Error('WebXR is not available in this browser');
    this.ensureAudio();
    const session = await navigator.xr.requestSession(mode, {
      requiredFeatures: ['local'],
      optionalFeatures: ['hand-tracking', 'local-floor'],
    });
    this.session = session;
    this.mode = mode;
    const ar = mode === 'immersive-ar';
    this.environment.visible = !ar;
    this.scene.background = ar ? null : new THREE.Color(0x07110e);
    this.renderer.setClearColor(0x000000, ar ? 0 : 1);
    for (const p of this.pointers) {
      p.hand.children.forEach((child) => {
        if (child.userData.isHandModel) child.visible = !ar || this.alwaysShowHands;
      });
    }
    session.addEventListener('end', () => {
      this.session = null;
      this.mode = null;
      this.environment.visible = true;
      this.scene.background = new THREE.Color(0x07110e);
      this.renderer.setClearColor(0x000000, 1);
      this.root.position.set(0, 0, 0);
      this.root.rotation.set(0, 0, 0);
      this.layoutPanels();
      this.resize();
      this.events.onSessionChange?.(false, null);
    });
    // Keep timers honest across the system menu or taking the headset off:
    // they run on wall-clock time, so there is nothing to pause. We just
    // repaint as soon as the view comes back.
    session.addEventListener('visibilitychange', () => {
      if (session.visibilityState === 'visible') this.panels.forEach((p) => p.invalidate());
    });
    await this.renderer.xr.setSession(session);
    this.recenterIn = 3;
    this.events.onSessionChange?.(true, mode);
  }

  async exit() {
    await this.session?.end();
  }

  /** Puts the panels back in front of wherever the cook is looking. */
  recenter() {
    const xrCamera = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera;
    const head = new THREE.Vector3();
    xrCamera.getWorldPosition(head);
    const dir = new THREE.Vector3();
    xrCamera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    this.root.position.copy(head);
    this.root.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    this.layoutPanels();
  }

  // ------------------------------------------------------------------ input

  private ensureAudio() {
    if (this.audio) {
      if (this.audio.state === 'suspended') void this.audio.resume();
      return;
    }
    try {
      this.audio = new AudioContext();
    } catch {
      this.audio = null;
    }
  }

  private tone(freq: number, startOffset: number, duration: number, gain = 0.08) {
    if (!this.audio) return;
    const ctx = this.audio;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + startOffset;
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Bare hands have no haptics, so every press gets a soft click instead. */
  private click() {
    this.tone(1320, 0, 0.05, 0.05);
  }

  private chime() {
    this.tone(880, 0, 0.35);
    this.tone(1175, 0.18, 0.35);
    this.tone(1568, 0.36, 0.6);
  }

  private raycastPanels(): { panel: Panel; button: ReturnType<Panel['buttonAt']>; point: THREE.Vector3 } | null {
    const hits = this.raycaster.intersectObjects(
      this.panels.filter((p) => p.group.visible).map((p) => p.mesh),
      false
    );
    const hit = hits[0];
    if (!hit || !hit.uv) return null;
    const panel = hit.object.userData.panel as Panel;
    const px = panel.uvToPx(hit.uv);
    return { panel, button: panel.buttonAt(px.x, px.y), point: hit.point };
  }

  private hitFromCamera() {
    this.raycaster.setFromCamera(this.mouse.ndc, this.camera);
    return this.raycastPanels();
  }

  private hitFromPointer(p: Pointer) {
    const origin = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    p.controller.getWorldPosition(origin);
    p.controller.getWorldQuaternion(quat);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    this.raycaster.set(origin, dir);
    return this.raycastPanels();
  }

  private onSelectStart(p: Pointer) {
    this.ensureAudio();
    const hit = this.hitFromPointer(p);
    if (!hit?.button) return;
    if (hit.button.handle) {
      const panelWorld = new THREE.Vector3();
      hit.panel.group.getWorldPosition(panelWorld);
      p.drag = { panel: hit.panel, offset: p.controller.worldToLocal(panelWorld) };
      this.click();
      return;
    }
    p.pressTarget = { panel: hit.panel, id: hit.button.id, at: performance.now() };
  }

  private onSelectEnd(p: Pointer) {
    if (p.drag) {
      p.drag = null;
      return;
    }
    const target = p.pressTarget;
    p.pressTarget = null;
    if (!target) return;
    const hit = this.hitFromPointer(p);
    // Fire on release if the ray is still on the same button. Pinching nudges
    // a hand ray a little, so a quick tap (under half a second) still counts
    // even if it slid off; a long pinch that wandered away does not.
    const stillOn = hit?.button && hit.button.id === target.id;
    const quickTap = performance.now() - target.at < 500;
    if (stillOn || quickTap) this.press(target.panel, target.id);
  }

  private press(panel: Panel, id: string) {
    const button = panel.buttons.find((b) => b.id === id);
    if (!button?.onPress) return;
    this.click();
    panel.flashId = id;
    panel.invalidate();
    window.setTimeout(() => {
      if (panel.flashId === id) {
        panel.flashId = null;
        panel.invalidate();
      }
    }, 160);
    button.onPress();
  }

  /** Fingertip poke: a button fires when the index tip pushes through it. */
  private updatePoke(p: Pointer, now: number, hover: Map<Panel, Set<string>>) {
    const tipJoint = p.hand.joints['index-finger-tip'];
    const tracked = Boolean(p.source?.hand && tipJoint && tipJoint.visible);
    p.tip.visible = tracked && this.mode === 'immersive-ar';
    if (!tracked || !tipJoint) {
      p.lastPokeZ.clear();
      return;
    }
    const tipWorld = new THREE.Vector3();
    tipJoint.getWorldPosition(tipWorld);
    p.tip.position.copy(tipWorld);
    for (const panel of this.panels) {
      if (!panel.group.visible) continue;
      // Your own wrist card cannot be poked by the hand it is attached to.
      if (panel === this.wrist && p.source?.handedness === 'left') continue;
      const local = panel.mesh.worldToLocal(tipWorld.clone());
      const inside =
        Math.abs(local.x) <= panel.widthM / 2 && Math.abs(local.y) <= panel.heightM / 2;
      const prevZ = p.lastPokeZ.get(panel) ?? Infinity;
      p.lastPokeZ.set(panel, local.z);
      if (!inside || local.z > HOVER_DEPTH || local.z < -0.05) continue;
      const px = panel.localToPx(local);
      const button = panel.buttonAt(px.x, px.y);
      if (!button || button.handle) continue;
      hover.get(panel)?.add(button.id);
      if (local.z < POKE_DEPTH && prevZ >= POKE_DEPTH && now - p.lastPokeAt > POKE_COOLDOWN_MS) {
        p.lastPokeAt = now;
        this.press(panel, button.id);
      }
    }
  }

  // ------------------------------------------------------------------ frame loop

  private tick(time: number) {
    if (this.disposed) return;
    const now = performance.now();
    if (this.recenterIn > 0) {
      this.recenterIn -= 1;
      if (this.recenterIn === 0) this.recenter();
    }

    const hover = new Map<Panel, Set<string>>();
    this.panels.forEach((panel) => hover.set(panel, new Set()));

    if (this.renderer.xr.isPresenting) {
      for (const p of this.pointers) {
        if (!p.source) {
          p.line.visible = false;
          p.cursor.visible = false;
          p.tip.visible = false;
          continue;
        }
        if (p.drag) {
          const world = p.controller.localToWorld(p.drag.offset.clone());
          p.drag.panel.group.position.copy(this.root.worldToLocal(world));
          const head = new THREE.Vector3();
          this.renderer.xr.getCamera().getWorldPosition(head);
          p.drag.panel.group.lookAt(head);
          hover.get(p.drag.panel)?.add(`${p.drag.panel.name}:handle`);
        }
        const hit = this.hitFromPointer(p);
        p.line.visible = true;
        const length = hit ? hit.point.distanceTo(p.controller.getWorldPosition(new THREE.Vector3())) : 0.6;
        p.line.scale.z = length;
        p.cursor.visible = Boolean(hit);
        if (hit) {
          p.cursor.position.copy(hit.point);
          if (hit.button) hover.get(hit.panel)?.add(hit.button.id);
        }
        this.updatePoke(p, now, hover);
      }
    } else if (this.mouse.inside) {
      const hit = this.hitFromCamera();
      if (hit?.button && !hit.button.handle) hover.get(hit.panel)?.add(hit.button.id);
      this.renderer.domElement.style.cursor = hit?.button && !hit.button.handle ? 'pointer' : 'default';
    }
    this.updateWrist();
    hover.forEach((ids, panel) => panel.setHover(ids));
    this.updateConfetti(now);

    // Timers tick on wall-clock time; repaint the timer panel a few times a second.
    if (now - this.lastTimerPaint > 250) {
      this.lastTimerPaint = now;
      let finishedOne = false;
      for (const t of this.timers) {
        if (!t.done && Date.now() >= t.endsAt) {
          t.done = true;
          finishedOne = true;
        }
      }
      if (finishedOne) {
        this.chime();
        this.save();
      }
      if (this.timers.length) {
        this.right.invalidate();
        if (this.wristShown) this.wrist.invalidate();
        // The step card shows its own countdown while that step's timer runs.
        if (this.screen === 'cook' && this.timers.some((t) => t.stepIndex === this.step)) {
          this.main.invalidate();
        }
      }
    }
    if (this.screen === 'reveal' && now - this.revealStart < 2200) this.main.invalidate();

    this.panels.forEach((panel) => panel.update());
    this.renderer.render(this.scene, this.camera);
    void time;
  }

  // ------------------------------------------------------------------ state

  private restore() {
    const saved = readSaved();
    if (!saved) {
      this.emitSummary();
      return;
    }
    const recipe = findXrRecipe(saved.recipeId);
    if (recipe) {
      this.recipe = recipe;
      this.screen = saved.screen;
      this.step = Math.min(Math.max(0, saved.step), recipe.steps.length - 1);
      this.checked = new Set(saved.checked.filter((i) => i >= 0 && i < recipe.ingredients.length));
      this.leftTab = saved.leftTab === 'label' ? 'label' : 'fresh';
      if (this.screen === 'reveal') this.revealStart = performance.now() - 5000;
    }
    this.timers = Array.isArray(saved.timers) ? saved.timers.filter((t) => typeof t.endsAt === 'number') : [];
    this.emitSummary();
  }

  private save() {
    const state: SavedState = {
      screen: this.screen,
      recipeId: this.recipe?.id ?? null,
      step: this.step,
      checked: [...this.checked],
      timers: this.timers,
      leftTab: this.leftTab,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing or storage blocked: the session still works, it just
      // will not resume after a reload.
    }
    this.emitSummary();
  }

  private emitSummary() {
    if (!this.recipe || this.screen === 'pick') {
      this.events.onStateChange?.(null);
      return;
    }
    const where =
      this.screen === 'cook'
        ? `step ${this.step + 1} of ${this.recipe.steps.length}`
        : this.screen === 'done'
          ? 'finished'
          : 'getting ingredients ready';
    this.events.onStateChange?.(`${this.recipe.title}, ${where}`);
  }

  private go(screen: Screen) {
    this.screen = screen;
    if (screen === 'reveal') this.revealStart = performance.now();
    if (screen === 'done') {
      this.celebrate();
      this.chime();
    }
    this.panels.forEach((p) => p.invalidate());
    this.save();
  }

  private chooseRecipe(recipe: XrRecipe) {
    this.recipe = recipe;
    this.step = 0;
    this.checked = new Set();
    this.leftTab = 'label';
    this.go('reveal');
  }

  private startTimer(stepIndex: number) {
    const step = this.recipe?.steps[stepIndex];
    if (!step?.timerSeconds) return;
    const durationMs = step.timerSeconds * 1000;
    this.timers.push({
      id: `${Date.now()}-${stepIndex}`,
      label: step.timerLabel ?? `Step ${stepIndex + 1}`,
      durationMs,
      endsAt: Date.now() + durationMs,
      done: false,
      stepIndex,
    });
    this.timers = this.timers.slice(-3);
    this.right.invalidate();
    this.main.invalidate();
    this.save();
  }

  private speak(text: string) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech is a nice-to-have.
    }
  }

  /** Test hook: lets automated checks drive the UI without a headset. */
  debugPress(panelName: 'main' | 'left' | 'right' | 'wrist', id: string) {
    const panel = this.panels.find((p) => p.name === panelName);
    if (!panel) return false;
    panel.update();
    const fullId = `${panelName}:${id}`;
    if (!panel.buttons.some((b) => b.id === fullId)) return false;
    this.press(panel, fullId);
    panel.update();
    return true;
  }

  /** Test hook: world-space center and normal of a button, for emulator tests. */
  debugButtonWorld(panelName: 'main' | 'left' | 'right' | 'wrist', id: string) {
    const panel = this.panels.find((p) => p.name === panelName);
    const b = panel?.buttons.find((x) => x.id === `${panelName}:${id}`);
    if (!panel || !b) return null;
    const local = new THREE.Vector3(
      ((b.x + b.w / 2) / panel.pxW - 0.5) * panel.widthM,
      (0.5 - (b.y + b.h / 2) / panel.pxH) * panel.heightM,
      0
    );
    const center = panel.mesh.localToWorld(local);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(panel.mesh.matrixWorld);
    return { center: center.toArray(), normal: normal.toArray() };
  }

  /** Test hook: where each input's fingertip and pinch ray are right now. */
  debugPointers() {
    return this.pointers.map((p) => {
      const tipJoint = p.hand.joints['index-finger-tip'];
      const tip = tipJoint ? tipJoint.getWorldPosition(new THREE.Vector3()).toArray() : null;
      const origin = p.controller.getWorldPosition(new THREE.Vector3()).toArray();
      const dir = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(p.controller.getWorldQuaternion(new THREE.Quaternion()))
        .toArray();
      const wristJoint = p.hand.joints['wrist'];
      const palm = wristJoint
        ? new THREE.Vector3(0, -1, 0).applyQuaternion(wristJoint.getWorldQuaternion(new THREE.Quaternion())).toArray()
        : null;
      return {
        palm,
        wristShown: this.wristShown,
        handedness: p.source?.handedness ?? null,
        hand: Boolean(p.source?.hand),
        tip,
        origin,
        dir,
      };
    });
  }

  debugState() {
    return {
      screen: this.screen,
      recipe: this.recipe?.id ?? null,
      step: this.step,
      checked: [...this.checked],
      timers: this.timers.map((t) => ({ label: t.label, done: t.done })),
      presenting: this.renderer.xr.isPresenting,
      buttons: Object.fromEntries(this.panels.map((p) => [p.name, p.buttons.map((b) => b.id)])),
    };
  }

  // ------------------------------------------------------------------ painting

  private paintMain(p: Panel) {
    const W = p.pxW;
    const H = p.pxH;
    const pad = 44;
    const recipe = this.recipe;

    if (this.screen === 'pick' || !recipe) {
      p.handle('Recipe Reborn kitchen');
      p.text('What are you replacing tonight?', pad, 92, 46, PALETTE.text, 800);
      p.text('Pick a packaged food. We will cook the fresh version together.', pad, 152, 26, PALETTE.muted);
      const gap = 22;
      const cardW = (W - pad * 2 - gap * 2) / 3;
      const cardH = 420;
      const top = 210;
      XR_RECIPES.forEach((r, i) => {
        const x = pad + i * (cardW + gap);
        const { hovered, flashing } = p.area(`pick:${r.id}`, x, top, cardW, cardH, () => this.chooseRecipe(r));
        p.roundRect(
          x,
          top,
          cardW,
          cardH,
          28,
          flashing ? 'rgba(253,230,138,0.4)' : hovered ? PALETTE.cardHover : PALETTE.card,
          hovered ? PALETTE.focus : PALETTE.border,
          hovered ? 5 : 2
        );
        p.roundRect(x, top, cardW, 10, 5, r.accent);
        p.text('INSTEAD OF', x + 26, top + 36, 18, PALETTE.muted, 700);
        p.wrap(r.product, x + 26, top + 62, cardW - 52, 32, PALETTE.text, 800, 1.15, 2);
        p.text(`${r.labelIngredients.length} label ingredients`, x + 26, top + 150, 22, PALETTE.red, 600);
        p.ctx.fillStyle = PALETTE.border;
        p.ctx.fillRect(x + 26, top + 196, cardW - 52, 2);
        p.text('COOK', x + 26, top + 220, 18, PALETTE.muted, 700);
        p.wrap(r.title, x + 26, top + 246, cardW - 52, 30, PALETTE.green, 800, 1.15, 2);
        p.text(`${r.ingredients.length} ingredients · ${r.totalMinutes} min`, x + 26, top + 340, 22, PALETTE.muted);
        p.text(hovered ? 'Pinch to choose' : '', x + cardW / 2, top + cardH - 46, 22, PALETTE.focus, 700, 'center');
      });
      return;
    }

    p.handle(`${recipe.product} → ${recipe.title}`);

    if (this.screen === 'reveal') {
      const t = Math.min(1, (performance.now() - this.revealStart) / 2000);
      p.text('The label vs. your kitchen', pad, 88, 42, PALETTE.text, 800);
      const colW = (W - pad * 3) / 2;
      // Left: the label, with unfamiliar additives crossed out one by one.
      p.text(`ON THE LABEL · ${recipe.labelIngredients.length}`, pad, 156, 20, PALETTE.red, 800);
      const struck = Math.floor(t * recipe.unfamiliar.length + 0.0001);
      recipe.unfamiliar.forEach((item, i) => {
        const y = 192 + i * 50;
        p.roundRect(pad, y, colW, 42, 14, 'rgba(248,113,113,0.12)');
        p.text(p.fitText(item, colW - 30, 24), pad + 16, y + 9, 24, i < struck ? PALETTE.muted : PALETTE.text, 600);
        if (i < struck) {
          p.ctx.strokeStyle = PALETTE.red;
          p.ctx.lineWidth = 3;
          p.ctx.beginPath();
          p.ctx.moveTo(pad + 12, y + 22);
          p.ctx.lineTo(pad + colW - 12, y + 22);
          p.ctx.stroke();
        }
      });
      const others = recipe.labelIngredients.length - recipe.unfamiliar.length;
      p.text(`+ ${others} more`, pad, 192 + recipe.unfamiliar.length * 50 + 6, 22, PALETTE.muted);
      // Right: the fresh version fades in.
      const rx = pad * 2 + colW;
      p.ctx.globalAlpha = Math.min(1, t * 1.6);
      p.text(`FRESH VERSION · ${recipe.ingredients.length}`, rx, 156, 20, PALETTE.green, 800);
      p.wrap(recipe.title, rx, 190, colW, 34, PALETTE.text, 800, 1.15, 2);
      p.wrap(recipe.tagline, rx, 276, colW, 24, PALETTE.muted, 500, 1.3, 2);
      p.text(`${recipe.totalMinutes} min · serves ${recipe.servings}`, rx, 346, 24, PALETTE.green, 700);
      p.wrap(
        `Every one of those additives is gone. You need ${recipe.ingredients.length} kitchen staples instead.`,
        rx,
        396,
        colW,
        24,
        PALETTE.text,
        500,
        1.3,
        4
      );
      p.ctx.globalAlpha = 1;
      p.button('back', pad, H - 120, 200, 80, 'Back', () => this.go('pick'), 'ghost');
      p.button('gather', W - pad - 380, H - 120, 380, 80, 'Gather ingredients', () => {
        this.leftTab = 'fresh';
        this.go('prep');
      }, 'primary');
      return;
    }

    if (this.screen === 'prep') {
      const ready = this.checked.size;
      const total = recipe.ingredients.length;
      p.text('Gather your ingredients', pad, 92, 44, PALETTE.text, 800);
      p.wrap(
        'Tap each one on the left panel as you set it on the counter. Poke it with a fingertip or pinch from where you sit.',
        pad,
        156,
        W - pad * 2,
        28,
        PALETTE.muted,
        500,
        1.3,
        3
      );
      p.text(`${ready} of ${total} ready`, pad, 300, 36, ready === total ? PALETTE.green : PALETTE.text, 800);
      p.roundRect(pad, 356, W - pad * 2, 22, 11, 'rgba(255,255,255,0.08)');
      if (ready) p.roundRect(pad, 356, ((W - pad * 2) * ready) / total, 22, 11, PALETTE.green);
      p.button('back', pad, H - 120, 200, 80, 'Back', () => this.go('reveal'), 'ghost');
      p.button('start', W - pad - 380, H - 120, 380, 80, ready === total ? 'Start cooking' : 'Start anyway', () => {
        this.step = 0;
        this.go('cook');
      }, 'primary');
      return;
    }

    if (this.screen === 'cook') {
      const step = recipe.steps[this.step];
      const total = recipe.steps.length;
      p.text(`STEP ${this.step + 1} OF ${total}`, pad, 88, 22, PALETTE.green, 800);
      const pipW = (W - pad * 2 - (total - 1) * 8) / total;
      for (let i = 0; i < total; i += 1) {
        p.roundRect(pad + i * (pipW + 8), 122, pipW, 10, 5, i <= this.step ? PALETTE.green : 'rgba(255,255,255,0.12)');
      }
      p.wrap(step.text, pad, 168, W - pad * 2, 46, PALETTE.text, 700, 1.25, 5);
      const running = this.timers.find((t) => t.stepIndex === this.step && !t.done);
      if (step.timerSeconds) {
        if (running) {
          p.text(`${step.timerLabel ?? 'Timer'} running: ${formatClock(running.endsAt - Date.now())}`, pad, H - 220, 30, PALETTE.orange, 700);
        } else {
          p.button(
            'timer',
            pad,
            H - 240,
            W - pad * 2,
            84,
            `Start ${minutesLabel(step.timerSeconds)} timer`,
            () => this.startTimer(this.step),
            'secondary',
            32
          );
        }
      }
      const bw = (W - pad * 2 - 40) / 3;
      p.button('prev', pad, H - 130, bw, 90, 'Back', () => {
        if (this.step === 0) this.go('prep');
        else {
          this.step -= 1;
          this.go('cook');
        }
      }, 'ghost', 32);
      p.button('read', pad + bw + 20, H - 130, bw, 90, 'Read aloud', () => this.speak(step.text), 'secondary', 30);
      const last = this.step === total - 1;
      p.button('next', pad + (bw + 20) * 2, H - 130, bw, 90, last ? 'Finish' : 'Next', () => {
        if (last) this.go('done');
        else {
          this.step += 1;
          this.go('cook');
        }
      }, 'primary', 34);
      return;
    }

    // done
    p.text('Dinner, reborn.', pad, 110, 64, PALETTE.green, 900);
    p.wrap(
      `You swapped a ${recipe.labelIngredients.length}-ingredient ${recipe.product.toLowerCase()} for ${recipe.title.toLowerCase()} made from ${recipe.ingredients.length} kitchen staples.`,
      pad,
      210,
      W - pad * 2,
      32,
      PALETTE.text,
      500,
      1.35,
      4
    );
    p.text('Save it, plan it and shop for it at recipereborn.com', pad, 400, 26, PALETTE.muted);
    p.button('again', pad, H - 130, 360, 90, 'Cook another', () => {
      this.recipe = null;
      this.timers = this.timers.filter((t) => !t.done);
      this.go('pick');
    }, 'primary', 32);
    if (this.session) {
      p.button('exit', W - pad - 260, H - 130, 260, 90, 'Exit', () => void this.exit(), 'ghost', 32);
    }
  }

  private paintLeft(p: Panel) {
    const W = p.pxW;
    const pad = 32;
    const recipe = this.recipe;
    if (!recipe || this.screen === 'pick') {
      p.handle('How it works');
      const tips: [string, string][] = [
        ['Pinch', 'Point your hand at a button, pinch thumb and finger, then let go.'],
        ['Poke', 'Or reach out and press a button with your fingertip.'],
        ['Move', 'Pinch and hold a panel’s top bar to drag it closer.'],
        ['Hands only', 'No controllers needed. Messy hands welcome.'],
      ];
      let y = 96;
      tips.forEach(([title, body]) => {
        p.text(title, pad, y, 30, PALETTE.green, 800);
        y = p.wrap(body, pad, y + 40, W - pad * 2, 25, PALETTE.text, 500, 1.3, 3) + 24;
      });
      return;
    }

    p.handle('Ingredients');
    const tabW = (W - pad * 2 - 12) / 2;
    p.button('tab:fresh', pad, 84, tabW, 64, 'Fresh', () => {
      this.leftTab = 'fresh';
      this.left.invalidate();
      this.save();
    }, this.leftTab === 'fresh' ? 'primary' : 'ghost', 26);
    p.button('tab:label', pad + tabW + 12, 84, tabW, 64, 'The label', () => {
      this.leftTab = 'label';
      this.left.invalidate();
      this.save();
    }, this.leftTab === 'label' ? 'primary' : 'ghost', 26);

    const top = 168;
    if (this.leftTab === 'fresh') {
      const rowH = Math.min(68, (p.pxH - top - 20) / recipe.ingredients.length);
      recipe.ingredients.forEach((item, i) => {
        const y = top + i * rowH;
        const done = this.checked.has(i);
        const { hovered, flashing } = p.area(`ing:${i}`, pad, y, W - pad * 2, rowH - 8, () => {
          if (this.checked.has(i)) this.checked.delete(i);
          else this.checked.add(i);
          this.left.invalidate();
          this.main.invalidate();
          this.save();
        });
        p.roundRect(
          pad,
          y,
          W - pad * 2,
          rowH - 8,
          16,
          flashing ? 'rgba(253,230,138,0.4)' : hovered ? PALETTE.cardHover : done ? 'rgba(52,211,153,0.14)' : PALETTE.card,
          hovered ? PALETTE.focus : 'rgba(0,0,0,0)',
          3
        );
        const box = rowH - 30;
        p.roundRect(pad + 14, y + 11, box, box, 8, done ? PALETTE.green : 'rgba(0,0,0,0)', done ? PALETTE.green : PALETTE.muted, 3);
        if (done) p.text('✓', pad + 14 + box / 2, y + 11 + (box - 28) / 2, 28, PALETTE.bgSolid, 900, 'center');
        p.text(
          p.fitText(item, W - pad * 2 - box - 44, 24),
          pad + box + 30,
          y + (rowH - 8 - 24) / 2,
          24,
          done ? PALETTE.muted : PALETTE.text,
          600
        );
      });
    } else {
      const items = recipe.labelIngredients;
      const rowH = Math.min(46, (p.pxH - top - 60) / items.length);
      items.forEach((item, i) => {
        const y = top + i * rowH;
        const odd = recipe.unfamiliar.includes(item);
        p.text(p.fitText(item, W - pad * 2 - 110, 22), pad, y + 8, 22, odd ? PALETTE.red : PALETTE.text, odd ? 700 : 500);
        if (odd) p.text('gone', W - pad, y + 10, 18, PALETTE.red, 800, 'right');
      });
      p.text('Red items do not appear in your version.', pad, p.pxH - 48, 20, PALETTE.muted);
    }
  }

  private paintRight(p: Panel) {
    const W = p.pxW;
    const H = p.pxH;
    const pad = 32;
    p.handle('Timers');
    if (!this.timers.length) {
      p.wrap(
        'When a step needs time, start its timer with one pinch. Timers keep running even if you take the headset off.',
        pad,
        100,
        W - pad * 2,
        26,
        PALETTE.muted,
        500,
        1.35,
        6
      );
    }
    const now = Date.now();
    this.timers.forEach((t, i) => {
      const y = 88 + i * 180;
      const remaining = t.endsAt - now;
      const progress = 1 - Math.max(0, remaining) / t.durationMs;
      const blink = t.done && Math.floor(now / 500) % 2 === 0;
      p.roundRect(pad, y, W - pad * 2, 166, 22, t.done ? (blink ? 'rgba(251,146,60,0.45)' : 'rgba(251,146,60,0.2)') : PALETTE.card, t.done ? PALETTE.orange : PALETTE.border, 3);
      p.text(p.fitText(t.label, W - pad * 2 - 40, 24), pad + 20, y + 16, 24, PALETTE.muted, 700);
      p.text(t.done ? 'Done!' : formatClock(remaining), pad + 20, y + 46, 52, t.done ? PALETTE.orange : PALETTE.text, 800);
      p.roundRect(pad + 20, y + 112, W - pad * 2 - 40, 10, 5, 'rgba(255,255,255,0.1)');
      p.roundRect(pad + 20, y + 112, Math.max(10, (W - pad * 2 - 40) * progress), 10, 5, t.done ? PALETTE.orange : PALETTE.green);
      if (!t.done) {
        p.button(`plus:${t.id}`, W - pad - 236, y + 46, 110, 54, '+1 min', () => {
          t.endsAt += 60000;
          t.durationMs += 60000;
          this.save();
        }, 'secondary', 22);
      }
      p.button(`clear:${t.id}`, W - pad - 116, y + 46, 96, 54, t.done ? 'OK' : 'Stop', () => {
        this.timers = this.timers.filter((x) => x.id !== t.id);
        this.right.invalidate();
        this.main.invalidate();
        this.save();
      }, t.done ? 'primary' : 'danger', 22);
    });
    if (this.session) {
      const bw = (W - pad * 2 - 16) / 2;
      p.button('recenter', pad, H - 96, bw, 68, 'Recenter', () => this.recenter(), 'ghost', 24);
      p.button('exit', pad + bw + 16, H - 96, bw, 68, 'Exit', () => void this.exit(), 'ghost', 24);
    }
  }

  // ------------------------------------------------------------------ wrist card

  private updateWrist() {
    const show = this.renderer.xr.isPresenting && this.screen === 'cook' && Boolean(this.recipe);
    const left = this.pointers.find((p) => p.source?.handedness === 'left' && p.source.hand);
    const wristJoint = left?.hand.joints['wrist'];
    if (!show || !left || !wristJoint || !wristJoint.visible) {
      this.setWristShown(false);
      return;
    }
    const wristPos = wristJoint.getWorldPosition(new THREE.Vector3());
    const wristQuat = wristJoint.getWorldQuaternion(new THREE.Quaternion());
    // WebXR hand joints: +Y points out of the back of the hand, so -Y is the palm.
    const palm = new THREE.Vector3(0, -1, 0).applyQuaternion(wristQuat);
    const head = this.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
    const toHead = head.clone().sub(wristPos).normalize();
    const facing = palm.dot(toHead);
    // Hysteresis so the card does not flicker at the threshold.
    const visible = this.wristShown ? facing > 0.45 : facing > 0.7;
    this.setWristShown(visible);
    if (!visible) return;
    const forearmToFingers = new THREE.Vector3(0, 0, -1).applyQuaternion(wristQuat);
    const anchor = wristPos
      .clone()
      .addScaledVector(palm, 0.045)
      .addScaledVector(forearmToFingers, -0.02);
    this.wrist.group.position.copy(anchor);
    this.wrist.group.lookAt(head);
  }

  private setWristShown(shown: boolean) {
    if (shown === this.wristShown) return;
    this.wristShown = shown;
    this.wrist.group.visible = shown;
    if (shown) this.wrist.invalidate();
  }

  private paintWrist(p: Panel) {
    const recipe = this.recipe;
    if (!recipe) return;
    const W = p.pxW;
    const H = p.pxH;
    const pad = 18;
    const step = recipe.steps[this.step];
    p.text(`STEP ${this.step + 1}/${recipe.steps.length}`, pad, 14, 18, PALETTE.green, 800);
    p.wrap(step.text, pad, 40, W - pad * 2 - 88, 19, PALETTE.text, 600, 1.2, 3);
    const running = this.timers
      .filter((t) => !t.done)
      .sort((a, b) => a.endsAt - b.endsAt)[0];
    const finished = this.timers.find((t) => t.done);
    if (finished) {
      p.text(`${finished.label}: done!`, pad, H - 40, 20, PALETTE.orange, 800);
    } else if (running) {
      p.text(`${running.label} ${formatClock(running.endsAt - Date.now())}`, pad, H - 40, 20, PALETTE.orange, 800);
    }
    const last = this.step === recipe.steps.length - 1;
    p.button('next', W - pad - 80, 34, 80, 80, last ? '✓' : '→', () => {
      if (last) this.go('done');
      else {
        this.step += 1;
        this.go('cook');
      }
    }, 'primary', 34);
  }

  // ------------------------------------------------------------------ celebration

  private celebrate() {
    this.clearConfetti();
    const count = 90;
    const geometry = new THREE.PlaneGeometry(0.012, 0.007);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const colors = [0x34d399, 0xfb923c, 0xfde68a, 0xf87171, 0x60a5fa];
    const origin = this.main.group.getWorldPosition(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0);
    const toward = new THREE.Vector3(0, 0, 1).transformDirection(this.main.group.matrixWorld);
    const positions: THREE.Vector3[] = [];
    const velocities: THREE.Vector3[] = [];
    const spins: THREE.Euler[] = [];
    for (let i = 0; i < count; i += 1) {
      positions.push(origin.clone().addScaledVector(toward, 0.03).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.12, 0)));
      velocities.push(
        up.clone().multiplyScalar(0.4 + Math.random() * 0.5)
          .addScaledVector(toward, 0.15 + Math.random() * 0.25)
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.2))
      );
      spins.push(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      mesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    this.scene.add(mesh);
    this.confetti = { mesh, positions, velocities, spins, start: performance.now() };
  }

  private updateConfetti(now: number) {
    const c = this.confetti;
    if (!c) return;
    const age = (now - c.start) / 1000;
    if (age > 2.6) {
      this.clearConfetti();
      return;
    }
    const dt = 1 / 72;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < c.positions.length; i += 1) {
      c.velocities[i].y -= 1.2 * dt;
      c.velocities[i].multiplyScalar(0.985);
      c.positions[i].addScaledVector(c.velocities[i], dt);
      c.spins[i].x += 0.15;
      c.spins[i].y += 0.1;
      q.setFromEuler(c.spins[i]);
      m.compose(c.positions[i], q, scale);
      c.mesh.setMatrixAt(i, m);
    }
    c.mesh.instanceMatrix.needsUpdate = true;
  }

  private clearConfetti() {
    if (!this.confetti) return;
    this.scene.remove(this.confetti.mesh);
    this.confetti.mesh.geometry.dispose();
    (this.confetti.mesh.material as THREE.Material).dispose();
    this.confetti.mesh.dispose();
    this.confetti = null;
  }

  // ------------------------------------------------------------------ teardown

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    void this.session?.end().catch(() => undefined);
    this.clearConfetti();
    this.panels.forEach((p) => p.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
    void this.audio?.close().catch(() => undefined);
  }
}
