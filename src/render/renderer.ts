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
  /** Row-major tile indices into `colors`. */
  tiles: Uint8Array;
  /** Placeholder fill per tile index, until atlases land (M0-06). */
  colors: readonly string[];
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
  drawRect(layer: LayerId, x: number, y: number, w: number, h: number, color: string): void;
  /** Placeholder: a colored rect derived from the id until M0-06 provides atlases. */
  drawSprite(
    layer: LayerId,
    id: string,
    frame: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
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
  push(layer: number, x: number, y: number, w: number, h: number, color: string): void {
    const i = this.n++;
    this.layer[i] = layer;
    this.x[i] = x;
    this.y[i] = y;
    this.w[i] = w;
    this.h[i] = h;
    this.color[i] = color;
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
  private spriteColors = new Map<string, string>();
  private byBottomEdge = (a: number, b: number): number => {
    const c = this.cmds;
    return (
      (c.y[a] as number) + (c.h[a] as number) - ((c.y[b] as number) + (c.h[b] as number)) || a - b
    );
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
  }

  drawRect(layer: LayerId, x: number, y: number, w: number, h: number, color: string): void {
    this.cmds.push(layer, x, y, w, h, color);
  }

  drawSprite(
    layer: LayerId,
    id: string,
    _frame: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    let c = this.spriteColors.get(id);
    if (c === undefined) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0;
      c = `hsl(${((hash % 360) + 360) % 360} 60% 60%)`;
      this.spriteColors.set(id, c);
    }
    this.cmds.push(layer, x, y, w, h, c);
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
        b.fillStyle = c.color[i] as string;
        b.fillRect(
          Math.round(c.x[i] as number) - ox,
          Math.round(c.y[i] as number) - oy,
          c.w[i] as number,
          c.h[i] as number,
        );
        calls++;
      }
    }
    this.drawCalls = calls;
    this.sctx.drawImage(this.back, 0, 0, this.width * this.scale, this.height * this.scale);
  }

  private drawGrid(g: TileGrid, ox: number, oy: number): number {
    const b = this.bctx;
    const c0 = Math.max(0, Math.floor((ox - g.x) / g.size));
    const r0 = Math.max(0, Math.floor((oy - g.y) / g.size));
    const c1 = Math.min(g.cols - 1, Math.floor((ox + this.width - 1 - g.x) / g.size));
    const r1 = Math.min(g.rows - 1, Math.floor((oy + this.height - 1 - g.y) / g.size));
    let calls = 0;
    for (let r = r0; r <= r1; r++) {
      for (let col = c0; col <= c1; col++) {
        b.fillStyle = g.colors[g.tiles[r * g.cols + col] as number] as string;
        b.fillRect(g.x + col * g.size - ox, g.y + r * g.size - oy, g.size, g.size);
        calls++;
      }
    }
    return calls;
  }
}
