import type { Atlas } from './atlas';
import type { ViewportInfo } from './viewport';

/** Draw layers, back to front. World layers are offset by the camera, Hud is screen space. */
export const Layer = {
  Ground: 0,
  Detail: 1,
  Objects: 2,
  Overhead: 3,
  Weather: 4,
  Grade: 5,
  Hud: 6,
} as const;
/** A draw layer. */
export type LayerId = (typeof Layer)[keyof typeof Layer];
const LAYER_COUNT = 7;

/** A grid of tile indices drawn in one call. */
export interface TileGrid {
  cols: number;
  rows: number;
  size: number;
  /** Row-major tile kinds. */
  tiles: Uint8Array;
  /** Atlas frame handle to draw for a tile kind right now (animated tiles vary over time). */
  frameOf: (kind: number) => number;
  /** World position of the top-left tile. */
  x: number;
  y: number;
}

/** What game code draws through. A WebGL backend can replace the Canvas 2D one. */
export interface Renderer {
  readonly width: number;
  readonly height: number;
  /** Starts a frame with the camera's whole-pixel position. */
  begin(camX: number, camY: number): void;
  drawRect(
    layer: LayerId,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    alpha?: number,
    blend?: GlobalCompositeOperation,
  ): void;
  /** Draws a soft round light with its centre at world (x, y). It adds to what is below it. */
  drawLight(
    layer: LayerId,
    x: number,
    y: number,
    radius: number,
    color: string,
    alpha: number,
  ): void;
  /** Draws an atlas frame with its origin at world (x, y). Get handles from the atlas once. */
  drawSprite(
    layer: LayerId,
    handle: number,
    x: number,
    y: number,
    flipX?: boolean,
    alpha?: number,
  ): void;
  /** Draws a prepared canvas (for example a cached chunk) with its top left at world (x, y). One draw call. */
  drawBlit(layer: LayerId, source: CanvasImageSource, x: number, y: number): void;
  drawTiles(layer: LayerId, grid: TileGrid): void;
  /** Sorts the Objects layer by y, draws every layer in order, presents with one scaled blit. */
  end(): void;
}

/** Pooled command storage so a frame allocates nothing in steady state. */
class Commands {
  n = 0;
  layer: number[] = [];
  x: number[] = [];
  y: number[] = [];
  w: number[] = [];
  h: number[] = [];
  color: string[] = [];
  /** Atlas handle for sprites, -1 for rects. */
  handle: number[] = [];
  flip: number[] = [];
  alpha: number[] = [];
  /** Composite operation for rects, or '' for the usual. */
  blend: string[] = [];
  sortY: number[] = [];
  push(
    layer: number,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    alpha = 1,
    blend = '',
  ): void {
    const i = this.n++;
    this.layer[i] = layer;
    this.x[i] = x;
    this.y[i] = y;
    this.w[i] = w;
    this.h[i] = h;
    this.color[i] = color;
    this.handle[i] = -1;
    this.flip[i] = 0;
    this.alpha[i] = alpha;
    this.blend[i] = blend;
    this.sortY[i] = y + h;
  }
  pushSprite(layer: number, handle: number, x: number, y: number, flip: boolean, alpha = 1): void {
    const i = this.n++;
    this.layer[i] = layer;
    this.x[i] = x;
    this.y[i] = y;
    this.w[i] = 0;
    this.h[i] = 0;
    this.color[i] = '';
    this.handle[i] = handle;
    this.flip[i] = flip ? 1 : 0;
    this.alpha[i] = alpha;
    this.blend[i] = '';
    this.sortY[i] = y;
  }
}

/** Canvas 2D renderer: logical backbuffer, one integer-scaled blit to the screen canvas. */
export class Canvas2DRenderer implements Renderer {
  width = 1;
  height = 1;
  private back: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private sctx: CanvasRenderingContext2D;
  private cmds = new Commands();
  private order = new Int32Array(1024);
  private tiles: TileGrid[] = [];
  private tileLayer: number[] = [];
  private tileCount = 0;
  private camX = 0;
  private camY = 0;
  private scale = 1;
  private atlas: Atlas | null = null;
  private blits: CanvasImageSource[] = [];
  private blitCount = 0;
  /** Chunk blits in the last completed frame. */
  terrainBlits = 0;
  private byBottomEdge = (a: number, b: number): number => {
    const c = this.cmds;
    return (c.sortY[a] as number) - (c.sortY[b] as number) || a - b;
  };
  /** Draw calls in the last completed frame. */
  drawCalls = 0;

  constructor(private readonly screen: HTMLCanvasElement) {
    const sctx = screen.getContext('2d', { alpha: false });
    this.back = document.createElement('canvas');
    const bctx = this.back.getContext('2d', { alpha: false });
    if (!sctx || !bctx) throw new Error('2d context unavailable');
    this.sctx = sctx;
    this.bctx = bctx;
  }

  /** Sets the atlas used by `drawSprite` and `drawTiles`. */
  setAtlas(atlas: Atlas): void {
    this.atlas = atlas;
  }

  /** Re-fits to a new viewport. Safe to call any time; the next frame draws at the new size. */
  resize(v: ViewportInfo): void {
    this.width = v.width;
    this.height = v.height;
    this.scale = v.scale;
    this.back.width = v.width;
    this.back.height = v.height;
    this.screen.width = v.physWidth;
    this.screen.height = v.physHeight;
    this.screen.style.width = `${v.cssWidth}px`;
    this.screen.style.height = `${v.cssHeight}px`;
    this.bctx.imageSmoothingEnabled = false;
    this.sctx.imageSmoothingEnabled = false;
  }

  begin(camX: number, camY: number): void {
    this.camX = camX;
    this.camY = camY;
    this.cmds.n = 0;
    this.tileCount = 0;
    this.blitCount = 0;
  }

  drawRect(
    layer: LayerId,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    alpha = 1,
    blend: GlobalCompositeOperation | '' = '',
  ): void {
    this.cmds.push(layer, x, y, w, h, color, alpha, blend);
  }

  drawLight(
    layer: LayerId,
    x: number,
    y: number,
    radius: number,
    color: string,
    alpha: number,
  ): void {
    // A light is a rect command with the colour and a negative width: the radius.
    this.cmds.push(layer, x, y, -radius, 0, color, alpha, 'lighter');
  }

  drawSprite(layer: LayerId, handle: number, x: number, y: number, flipX = false, alpha = 1): void {
    this.cmds.pushSprite(layer, handle, x, y, flipX, alpha);
  }

  drawBlit(layer: LayerId, source: CanvasImageSource, x: number, y: number): void {
    // Blits are stored with a negative handle: -2 - index into the per-frame source list.
    this.blits[this.blitCount] = source;
    this.cmds.pushSprite(layer, -2 - this.blitCount, x, y, false);
    this.blitCount++;
  }

  drawTiles(layer: LayerId, grid: TileGrid): void {
    this.tiles[this.tileCount] = grid;
    this.tileLayer[this.tileCount] = layer;
    this.tileCount++;
  }

  end(): void {
    const b = this.bctx;
    const c = this.cmds;
    b.fillStyle = '#14121f';
    b.fillRect(0, 0, this.width, this.height);
    if (this.order.length < c.n) this.order = new Int32Array(c.n * 2);
    let calls = 0;
    let blits = 0;

    for (let layer = 0; layer < LAYER_COUNT; layer++) {
      const screenSpace = layer === Layer.Hud;
      const ox = screenSpace ? 0 : this.camX;
      const oy = screenSpace ? 0 : this.camY;

      for (let t = 0; t < this.tileCount; t++) {
        if (this.tileLayer[t] === layer) calls += this.drawGrid(this.tiles[t] as TileGrid, ox, oy);
      }

      let m = 0;
      for (let i = 0; i < c.n; i++) if (c.layer[i] === layer) this.order[m++] = i;
      if (layer === Layer.Objects && m > 1) {
        // y-sort by bottom edge, then insertion order for stability.
        const sub = this.order.subarray(0, m);
        sub.sort(this.byBottomEdge);
      }
      for (let k = 0; k < m; k++) {
        const i = this.order[k] as number;
        const handle = c.handle[i] as number;
        const sx = Math.round(c.x[i] as number) - ox;
        const sy = Math.round(c.y[i] as number) - oy;
        if (handle >= 0) {
          const alpha = c.alpha[i] as number;
          if (alpha < 1) b.globalAlpha = alpha;
          this.blitSprite(handle, sx, sy, c.flip[i] === 1);
          if (alpha < 1) b.globalAlpha = 1;
        } else if (handle <= -2) {
          b.drawImage(this.blits[-2 - handle] as CanvasImageSource, sx, sy);
          blits++;
        } else if ((c.w[i] as number) < 0) {
          // A light: a cached radial gradient of the colour, scaled to the radius.
          const r = -(c.w[i] as number);
          b.globalCompositeOperation = 'lighter';
          b.globalAlpha = c.alpha[i] as number;
          b.drawImage(this.lightImage(c.color[i] as string), sx - r, sy - r, r * 2, r * 2);
          b.globalAlpha = 1;
          b.globalCompositeOperation = 'source-over';
        } else {
          const a = c.alpha[i] as number;
          const blend = c.blend[i] as string;
          if (a < 1) b.globalAlpha = a;
          if (blend) b.globalCompositeOperation = blend as GlobalCompositeOperation;
          b.fillStyle = c.color[i] as string;
          b.fillRect(sx, sy, c.w[i] as number, c.h[i] as number);
          if (blend) b.globalCompositeOperation = 'source-over';
          if (a < 1) b.globalAlpha = 1;
        }
        calls++;
      }
    }
    this.drawCalls = calls;
    this.terrainBlits = blits;
    this.sctx.drawImage(this.back, 0, 0, this.width * this.scale, this.height * this.scale);
  }

  private lights = new Map<string, HTMLCanvasElement>();

  /** A 64 px radial gradient from the colour to nothing, made once per colour. */
  private lightImage(color: string): HTMLCanvasElement {
    let img = this.lights.get(color);
    if (!img) {
      img = document.createElement('canvas');
      img.width = 64;
      img.height = 64;
      const g = img.getContext('2d') as CanvasRenderingContext2D;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, color);
      grad.addColorStop(0.45, color);
      grad.addColorStop(1, '#000000');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this.lights.set(color, img);
    }
    return img;
  }

  private drawGrid(g: TileGrid, ox: number, oy: number): number {
    const c0 = Math.max(0, Math.floor((ox - g.x) / g.size));
    const r0 = Math.max(0, Math.floor((oy - g.y) / g.size));
    const c1 = Math.min(g.cols - 1, Math.floor((ox + this.width - 1 - g.x) / g.size));
    const r1 = Math.min(g.rows - 1, Math.floor((oy + this.height - 1 - g.y) / g.size));
    let calls = 0;
    for (let r = r0; r <= r1; r++) {
      for (let col = c0; col <= c1; col++) {
        const handle = g.frameOf(g.tiles[r * g.cols + col] as number);
        this.blitFrame(handle, g.x + col * g.size - ox, g.y + r * g.size - oy, false);
        calls++;
      }
    }
    return calls;
  }

  /** Draws a frame with its origin at screen (x, y). */
  private blitSprite(handle: number, x: number, y: number, flip: boolean): void {
    const a = this.atlas;
    if (!a) return;
    const w = a.width(handle);
    const ox = a.originX(handle);
    const oy = a.originY(handle);
    this.blitFrame(handle, x - (flip ? w - ox : ox), y - oy, flip);
  }

  /** Draws a frame with its top-left at screen (dx, dy). */
  private blitFrame(handle: number, dx: number, dy: number, flip: boolean): void {
    const a = this.atlas;
    if (!a) return;
    const b = this.bctx;
    const w = a.width(handle);
    const h = a.height(handle);
    if (flip) b.setTransform(-1, 0, 0, 1, 2 * dx + w, 0);
    b.drawImage(a.image(handle), a.srcX(handle), a.srcY(handle), w, h, dx, dy, w, h);
    if (flip) b.setTransform(1, 0, 0, 1, 0, 0);
  }
}
