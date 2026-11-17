import { PALETTE } from '../../content/sprites/palette';

/** Logical size of the scene. The canvas is scaled up with crisp pixels by CSS. */
export const SCENE_W = 128;
export const SCENE_H = 176;

const CX = 64;
const CY = 78;
const OUT_X = 31;
const OUT_Y = 41;
const IN_X = 23;
const IN_Y = 33;

const rgb = (i: number): [number, number, number] => {
  const h = PALETTE[i] as string;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};

/** Dark to light: deep blue, violet, blue, violet, light blue, light violet, pale. Palette indices. */
const SWIRL = [12, 24, 13, 25, 14, 26, 15, 27].map(rgb);
const STONE = [16, 17, 18, 19].map(rgb);
const NIGHT = rgb(0);
const GROUND = [rgb(16), rgb(17)];
const STAR = [rgb(2), rgb(3)];
const RUNE = rgb(47);

/** A tiny seeded generator, so the stars are the same every time. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The title scene: a stone portal ring at night with a swirling gate, drawn pixel by pixel from
 * the master palette. `entering` makes the gate flare, for the moment a character steps through.
 * Draws on its own frame loop, and once if the player prefers reduced motion.
 */
export class PortalScene {
  readonly canvas: HTMLCanvasElement;
  entering = false;
  private raf = 0;
  private enterAt = 0;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private readonly stars: { x: number; y: number; ph: number }[];
  private readonly still: boolean;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCENE_W;
    this.canvas.height = SCENE_H;
    this.canvas.className = 'pow-portal-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.img = ctx.createImageData(SCENE_W, SCENE_H);
    const r = rng(77);
    this.stars = Array.from({ length: 46 }, () => ({
      x: Math.floor(r() * SCENE_W),
      y: Math.floor(r() * 118),
      ph: r() * 6.28,
    }));
    this.still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.draw(0);
    if (!this.still) {
      const loop = (ms: number): void => {
        this.draw(ms / 1000);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
  }

  /** The gate flares and the swirl speeds up. */
  enter(): void {
    this.entering = true;
    this.enterAt = performance.now() / 1000;
    if (this.still) this.draw(this.enterAt);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }

  private put(x: number, y: number, c: readonly number[], a = 1): void {
    if (x < 0 || y < 0 || x >= SCENE_W || y >= SCENE_H) return;
    const i = (y * SCENE_W + x) * 4;
    const d = this.img.data;
    d[i] = (c[0] as number) * a + (d[i] as number) * (1 - a);
    d[i + 1] = (c[1] as number) * a + (d[i + 1] as number) * (1 - a);
    d[i + 2] = (c[2] as number) * a + (d[i + 2] as number) * (1 - a);
    d[i + 3] = 255;
  }

  private draw(t: number): void {
    const flare = this.entering ? Math.min(1, (t - this.enterAt) / 0.8) : 0;
    const speed = 1 + flare * 3;
    for (let y = 0; y < SCENE_H; y++) for (let x = 0; x < SCENE_W; x++) this.put(x, y, NIGHT);
    for (const s of this.stars) {
      const tw = Math.sin(t * 1.4 + s.ph) > 0.2;
      this.put(s.x, s.y, STAR[tw ? 1 : 0] as number[], tw ? 1 : 0.6);
    }
    // Ground: a dark stone floor with the portal's reflected glow.
    for (let y = 126; y < SCENE_H; y++) {
      for (let x = 0; x < SCENE_W; x++) {
        const speck = (x * 7 + y * 13) % 11 === 0;
        this.put(x, y, GROUND[speck ? 1 : 0] as number[]);
        const gd = Math.hypot((x - CX) / 46, (y - 134) / 8);
        if (gd < 1) this.put(x, y, SWIRL[3] as number[], 0.35 * (1 - gd) * (1 + flare));
      }
    }
    // Glow around the ring.
    for (let y = CY - OUT_Y - 8; y <= CY + OUT_Y + 8; y++) {
      for (let x = CX - OUT_X - 8; x <= CX + OUT_X + 8; x++) {
        const o = Math.hypot((x - CX) / OUT_X, (y - CY) / OUT_Y);
        if (o > 1 && o < 1.22)
          this.put(x, y, SWIRL[3] as number[], 0.28 * (1.22 - o) * 4.5 * (1 + flare * 0.6));
      }
    }
    // Ring and gate.
    for (let y = CY - OUT_Y; y <= CY + OUT_Y; y++) {
      for (let x = CX - OUT_X; x <= CX + OUT_X; x++) {
        const dx = x - CX;
        const dy = y - CY;
        const o = Math.hypot(dx / OUT_X, dy / OUT_Y);
        if (o > 1) continue;
        const inner = Math.hypot(dx / IN_X, dy / IN_Y);
        if (inner > 1) {
          // Stone ring, lit from the upper left.
          const lit = (-dx / OUT_X) * 0.6 + (-dy / OUT_Y) * 0.8;
          const block = (Math.floor((Math.atan2(dy, dx) + 3.1416) * 9) + (o > 0.89 ? 1 : 0)) % 2;
          const tone = lit > 0.45 ? 3 : lit > -0.05 ? 2 : lit > -0.55 ? 1 : 0;
          this.put(x, y, STONE[Math.max(0, tone - (block === 0 ? 0 : 1))] as number[]);
        } else {
          const a = Math.atan2(dy, dx);
          const v =
            Math.sin(a * 3 + inner * 7 - t * 1.7 * speed) +
            Math.sin(inner * 12 - t * 2.4 * speed) * 0.8 +
            Math.sin(a * 5 - t * 0.9 * speed) * 0.4;
          const base = (v + 2.2) / 4.4 + (1 - inner) * 0.35 + flare * 0.35;
          const k = Math.max(0, Math.min(SWIRL.length - 1, Math.floor(base * SWIRL.length)));
          // Ordered dither between neighbours for a crisp pixel look.
          const dither = (x + y) % 2 === 0 ? 0 : 1;
          this.put(x, y, SWIRL[Math.max(0, Math.min(SWIRL.length - 1, k - dither))] as number[]);
        }
      }
    }
    // Runes on the ring that pulse in turn.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.2832 + 0.39;
      const rx = Math.round(CX + Math.cos(a) * ((OUT_X + IN_X) / 2));
      const ry = Math.round(CY + Math.sin(a) * ((OUT_Y + IN_Y) / 2));
      const on = Math.sin(t * 1.6 - i * 0.8) > -0.2 || flare > 0.2;
      if (on) {
        this.put(rx, ry, RUNE);
        this.put(rx + 1, ry, RUNE, 0.6);
        this.put(rx, ry + 1, RUNE, 0.6);
      }
    }
    // The step the portal stands on.
    for (let x = CX - 38; x <= CX + 38; x++) {
      this.put(x, CY + OUT_Y + 1, STONE[3] as number[]);
      this.put(x, CY + OUT_Y + 2, STONE[2] as number[]);
    }
    for (let x = CX - 44; x <= CX + 44; x++) {
      this.put(x, CY + OUT_Y + 3, STONE[2] as number[]);
      this.put(x, CY + OUT_Y + 4, STONE[1] as number[]);
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}
