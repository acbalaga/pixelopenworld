import { PANEL_SLICE } from '../content/sprites/ui/panel';
import type { Atlas } from '../render/atlas';
import type { Renderer } from '../render/renderer';
import { Layer } from '../render/renderer';

export type PanelVariant = 'base' | 'pressed';

/** A 9-slice panel on the canvas. Built once per size and registered in the atlas, so a panel is one sprite draw. */
export class PanelCache {
  private cache = new Map<string, number>();
  private handle: Record<PanelVariant, number>;

  constructor(private readonly atlas: Atlas) {
    this.handle = {
      base: atlas.frame('ui.panel', 'base'),
      pressed: atlas.frame('ui.panel', 'pressed'),
    };
  }

  /** Atlas handle of the panel for a size in logical px, building it on first use. */
  get(w: number, h: number, variant: PanelVariant = 'base'): number {
    const key = `${w}x${h}:${variant}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.imageSmoothingEnabled = false;
    const a = this.atlas;
    const hd = this.handle[variant];
    const img = a.image(hd);
    const sx = a.srcX(hd);
    const sy = a.srcY(hd);
    const B = PANEL_SLICE;
    const M = a.width(hd) - B * 2; // middle span of the source
    const piece = (
      srcX: number,
      srcY: number,
      srcW: number,
      srcH: number,
      dx: number,
      dy: number,
    ): void => {
      ctx.drawImage(img, sx + srcX, sy + srcY, srcW, srcH, dx, dy, srcW, srcH);
    };
    // Corners.
    piece(0, 0, B, B, 0, 0);
    piece(B + M, 0, B, B, w - B, 0);
    piece(0, B + M, B, B, 0, h - B);
    piece(B + M, B + M, B, B, w - B, h - B);
    // Edges and center: tile the middle slice, cropping the last tile.
    for (let x = B; x < w - B; x += M) {
      const tw = Math.min(M, w - B - x);
      piece(B, 0, tw, B, x, 0);
      piece(B, B + M, tw, B, x, h - B);
      for (let y = B; y < h - B; y += M) piece(B, B, tw, Math.min(M, h - B - y), x, y);
    }
    for (let y = B; y < h - B; y += M) {
      const th = Math.min(M, h - B - y);
      piece(0, B, B, th, 0, y);
      piece(B + M, B, B, th, w - B, y);
    }
    const id = `ui.panel@${key}`;
    this.atlas.addSprite(id, c, {
      group: 'dynamic',
      size: [w, h],
      origin: [0, 0],
      frames: { base: { x: 0, y: 0, w, h } },
      anims: {},
    });
    const handle = this.atlas.frame(id, 'base');
    this.cache.set(key, handle);
    return handle;
  }

  /** Queues a panel with its top left at screen (x, y). */
  draw(
    r: Renderer,
    x: number,
    y: number,
    w: number,
    h: number,
    variant: PanelVariant = 'base',
  ): void {
    r.drawSprite(Layer.Hud, this.get(w, h, variant), x, y);
  }
}
