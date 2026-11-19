import * as THREE from 'three';

/**
 * A flat UI panel floating in space.
 *
 * Each panel is a plane with a 2D canvas as its texture. We draw the UI with
 * the ordinary Canvas 2D API and remember where every button was drawn, so a
 * pinch ray or a fingertip that lands on the plane can be turned back into a
 * button press. That keeps the whole XR UI dependency-free and fast enough for
 * 72-90 fps on Quest: a panel is redrawn only when something on it changes.
 */

export type PanelButton = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** A handle starts a drag instead of a press. */
  handle?: boolean;
  onPress?: () => void;
};

export type ButtonStyle = 'primary' | 'secondary' | 'ghost' | 'danger';

export const PALETTE = {
  bg: 'rgba(12, 24, 20, 0.92)',
  bgSolid: '#0c1814',
  card: 'rgba(255, 255, 255, 0.07)',
  cardHover: 'rgba(255, 255, 255, 0.16)',
  border: 'rgba(255, 255, 255, 0.14)',
  text: '#f8fafc',
  muted: '#a7b8b0',
  green: '#34d399',
  greenDeep: '#059669',
  orange: '#fb923c',
  red: '#f87171',
  focus: '#fde68a',
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export class Panel {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  readonly pxW: number;
  readonly pxH: number;
  buttons: PanelButton[] = [];
  hoverIds = new Set<string>();
  flashId: string | null = null;
  dirty = true;

  constructor(
    readonly name: string,
    readonly widthM: number,
    readonly heightM: number,
    private readonly paint: (panel: Panel) => void,
    pxPerMeter = 1800
  ) {
    this.pxW = Math.round(widthM * pxPerMeter);
    this.pxH = Math.round(heightM * pxPerMeter);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.pxW;
    this.canvas.height = this.pxH;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), material);
    this.mesh.userData.panel = this;
    this.mesh.name = `panel:${name}`;
    this.group.add(this.mesh);
  }

  /** Repaint if anything changed. Cheap to call every frame. */
  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.buttons = [];
    const { ctx } = this;
    ctx.clearRect(0, 0, this.pxW, this.pxH);
    this.roundRect(0, 0, this.pxW, this.pxH, 36, PALETTE.bg, PALETTE.border, 3);
    this.paint(this);
    this.texture.needsUpdate = true;
  }

  invalidate() {
    this.dirty = true;
  }

  /** Converts a hit on the plane (uv 0..1) to canvas pixels. */
  uvToPx(uv: THREE.Vector2) {
    return { x: uv.x * this.pxW, y: (1 - uv.y) * this.pxH };
  }

  /** Converts a point in the mesh's local space (meters) to canvas pixels. */
  localToPx(local: THREE.Vector3) {
    return {
      x: (local.x / this.widthM + 0.5) * this.pxW,
      y: (0.5 - local.y / this.heightM) * this.pxH,
    };
  }

  buttonAt(x: number, y: number): PanelButton | undefined {
    // Later buttons are drawn on top, so search from the end.
    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const b = this.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return undefined;
  }

  setHover(ids: Set<string>) {
    if (ids.size === this.hoverIds.size && [...ids].every((id) => this.hoverIds.has(id))) return;
    this.hoverIds = ids;
    this.dirty = true;
  }

  // ---------- drawing helpers ----------

  font(size: number, weight = 500) {
    this.ctx.font = `${weight} ${size}px ${FONT}`;
  }

  text(
    value: string,
    x: number,
    y: number,
    size: number,
    color: string = PALETTE.text,
    weight = 500,
    align: CanvasTextAlign = 'left'
  ) {
    const { ctx } = this;
    this.font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(value, x, y);
  }

  /** Word-wraps text into maxWidth. Returns the y below the last line. */
  wrap(
    value: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    color: string = PALETTE.text,
    weight = 500,
    lineHeight = 1.25,
    maxLines = 8
  ) {
    const { ctx } = this;
    this.font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const words = value.split(/\s+/);
    let line = '';
    let lines = 0;
    for (let i = 0; i < words.length; i += 1) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += size * lineHeight;
        lines += 1;
        line = words[i];
        if (lines >= maxLines) return y;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += size * lineHeight;
    }
    return y;
  }

  fitText(value: string, maxWidth: number, size: number, weight = 500) {
    this.font(size, weight);
    if (this.ctx.measureText(value).width <= maxWidth) return value;
    let cut = value;
    while (cut.length > 1 && this.ctx.measureText(`${cut}…`).width > maxWidth) {
      cut = cut.slice(0, -1);
    }
    return `${cut}…`;
  }

  roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string,
    stroke?: string,
    lineWidth = 2
  ) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Draws a title bar the user can pinch and hold to move the panel.
   * The grip dots make the affordance visible.
   */
  handle(title: string) {
    const id = `${this.name}:handle`;
    const hovered = this.hoverIds.has(id);
    this.roundRect(0, 0, this.pxW, 64, 36, hovered ? 'rgba(52,211,153,0.22)' : 'rgba(255,255,255,0.05)');
    this.ctx.fillStyle = hovered ? PALETTE.green : 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i += 1) {
      this.ctx.beginPath();
      this.ctx.arc(this.pxW / 2 - 25 + i * 10, 14, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.text(title.toUpperCase(), 32, 26, 22, PALETTE.muted, 700);
    this.buttons.push({ id, x: 0, y: 0, w: this.pxW, h: 64, handle: true });
  }

  button(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onPress: () => void,
    style: ButtonStyle = 'secondary',
    size = 30
  ) {
    const fullId = `${this.name}:${id}`;
    const hovered = this.hoverIds.has(fullId);
    const flashing = this.flashId === fullId;
    let fill = PALETTE.card;
    let stroke = PALETTE.border;
    let color = PALETTE.text;
    if (style === 'primary') {
      fill = hovered ? '#10b981' : PALETTE.greenDeep;
      stroke = hovered ? PALETTE.focus : 'rgba(255,255,255,0.25)';
    } else if (style === 'danger') {
      fill = hovered ? 'rgba(248,113,113,0.35)' : 'rgba(248,113,113,0.18)';
      stroke = hovered ? PALETTE.focus : 'rgba(248,113,113,0.5)';
    } else if (style === 'ghost') {
      fill = hovered ? PALETTE.cardHover : 'rgba(0,0,0,0)';
      stroke = hovered ? PALETTE.focus : 'rgba(255,255,255,0.1)';
      color = hovered ? PALETTE.text : PALETTE.muted;
    } else if (hovered) {
      fill = PALETTE.cardHover;
      stroke = PALETTE.focus;
    }
    if (flashing) fill = 'rgba(253,230,138,0.55)';
    this.roundRect(x, y, w, h, Math.min(24, h / 2), fill, stroke, hovered ? 4 : 2);
    this.text(this.fitText(label, w - 24, size, 700), x + w / 2, y + (h - size) / 2, size, color, 700, 'center');
    this.buttons.push({ id: fullId, x, y, w, h, onPress });
  }

  /** A large tappable area with custom contents. */
  area(id: string, x: number, y: number, w: number, h: number, onPress: () => void) {
    const fullId = `${this.name}:${id}`;
    this.buttons.push({ id: fullId, x, y, w, h, onPress });
    return { hovered: this.hoverIds.has(fullId), flashing: this.flashId === fullId };
  }

  dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
