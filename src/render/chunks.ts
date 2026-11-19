import { WORLD_TUNABLES } from '../content/balance/world';
import { GRASS_VARIANTS, TERRAINS, TILESET } from '../content/world/tileset';
import { blobIndex } from '../shared/autotile';
import { CHUNK_TILES, tileIndex, type Chunk } from '../sim/world/chunk';
import type { TileWorld } from '../sim/world/world';
import type { Atlas } from './atlas';
import { Layer, type Renderer } from './renderer';

/** Tile edge in logical px. */
export const TILE_PX = 16;
const CHUNK_PX = CHUNK_TILES * TILE_PX;

/** Where a tile definition's sprite is found, and how it is placed. */
export interface TileSprite {
  sprite: string;
  frame: string;
  offset?: readonly [number, number];
  /** `frame` names an animation, not a frame. */
  animated?: boolean;
}

/** Tiles painted per step, and steps per row, per pass, per phase. */
const SEGMENT = 8;
const SEGMENTS = CHUNK_TILES / SEGMENT;
const STEPS_PER_PHASE = CHUNK_TILES * SEGMENTS * 2;

/** A chunk being painted a few steps at a time. */
interface PaintJob {
  chunk: Chunk;
  canvases: HTMLCanvasElement[];
  ctxs: CanvasRenderingContext2D[];
  /** Steps painted so far, counting both passes of every phase. */
  step: number;
  total: number;
}

/** Fades roofs and canopies that an entity stands under. State is kept only while a fade is active. */
export class OverheadFader {
  private alpha = new Map<number, number>();
  /** Alpha to draw with this frame. `covering` is whether the entity is beneath the tile's overhead sprite. */
  step(key: number, covering: boolean, dtMs: number): number {
    const cur = this.alpha.get(key) ?? 1;
    const target = covering ? 0.4 : 1;
    const next =
      cur < target ? Math.min(target, cur + dtMs / 250) : Math.max(target, cur - dtMs / 250);
    if (next >= 1 && !covering) this.alpha.delete(key);
    else this.alpha.set(key, next);
    return next;
  }
}

/**
 * Draws a tile world. Ground and detail layers of each chunk are painted once into an offscreen
 * canvas (one per animation phase for chunks with animated terrain) and blitted, so terrain
 * costs one draw call per visible chunk however many tiles there are. Objects and overhead
 * tiles are drawn as sprites, because they sort against entities.
 */
export class ChunkRenderer {
  private cache = new Map<string, HTMLCanvasElement[]>();
  private tileFrame: number[] = [];
  private grass: number[];
  private bases = new Map<number, number[]>();
  private tileAnim: number[] = [];
  private blob = new Map<string, number[]>();
  private fader = new OverheadFader();
  /** Chunks painted since creation. Painting is the expensive step and happens once per chunk. */
  chunksBuilt = 0;
  /** Chunks that scrolled into view before they were painted and had to be finished at once. */
  stalls = 0;
  private job: PaintJob | null = null;
  /** Canvases of dropped chunks, ready to be painted again. */
  private readonly pool: HTMLCanvasElement[] = [];
  /** Frame budget for painting, ms. */
  budgetMs = (): number => WORLD_TUNABLES.paintBudgetMs;
  /** How long the previous frame's own work took, ms. Painting backs off when frames are heavy. */
  lastFrameMs = 0;
  /** True for chunk coordinates outside the region, which have no neighbor to wait for. */
  beyondEdge: (cx: number, cy: number) => boolean = () => false;

  constructor(
    private readonly atlas: Atlas,
    private readonly world: TileWorld,
    tiles: Readonly<Record<string, TileSprite>>,
  ) {
    this.tileFrame = TILESET.map((id, i) => {
      const t = tiles[id];
      if (!t) throw new Error(`tile ${id} missing from the manifest`);
      if (t.animated) {
        this.tileAnim[i] = atlas.anim(t.sprite, t.frame);
        return atlas.animFrame(this.tileAnim[i] as number, 0);
      }
      this.tileAnim[i] = -1;
      return atlas.frame(t.sprite, t.frame);
    });
    this.tileOffset = TILESET.map((id) => tiles[id]?.offset ?? [0, 0]);
    for (const t of TERRAINS) {
      this.terrainInfo[t.id] = t;
      if (t.bases)
        this.bases.set(
          t.id,
          t.bases.map((b) => atlas.frame(b, 'base')),
        );
    }
    this.grass = GRASS_VARIANTS.map((id) => atlas.frame(id, 'base'));
    for (const t of TERRAINS) {
      if (!t.overlay) continue;
      const frames: number[] = [];
      for (let i = 0; i < 47; i++) {
        for (let p = 0; p < t.overlay.phases; p++)
          frames[i * t.overlay.phases + p] = atlas.frame(
            t.overlay.sprite,
            `b${String(i).padStart(2, '0')}_${p}`,
          );
      }
      this.blob.set(t.key, frames);
    }
  }

  private tileOffset: (readonly [number, number])[];
  private terrainInfo: (typeof TERRAINS)[number][] = [];

  /** Starts painting a chunk. The job is resumed with {@link run} until it reports done. */
  private begin(chunk: Chunk): PaintJob {
    const phases = TERRAINS.reduce(
      (m, t) => (t.overlay && this.hasTerrain(chunk, t.id) ? Math.max(m, t.overlay.phases) : m),
      1,
    );
    const canvases: HTMLCanvasElement[] = [];
    const ctxs: CanvasRenderingContext2D[] = [];
    for (let i = 0; i < phases; i++) {
      // Canvases of dropped chunks are reused: allocating a megabyte each time and leaving the
      // old ones to the collector is what makes a frame hitch while crossing a region.
      const spare = this.pool.pop();
      const canvas = spare ?? document.createElement('canvas');
      if (!spare) {
        canvas.width = CHUNK_PX;
        canvas.height = CHUNK_PX;
      }
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error('2d context unavailable');
      ctx.imageSmoothingEnabled = false;
      if (spare) ctx.clearRect(0, 0, CHUNK_PX, CHUNK_PX);
      canvases.push(canvas);
      ctxs.push(ctx);
    }
    return { chunk, canvases, ctxs, step: 0, total: phases * STEPS_PER_PHASE };
  }

  /**
   * Paints a job in small steps until `deadline` (a `performance.now()` value) passes, or to the
   * end when `deadline` is Infinity. A step is a segment of {@link SEGMENT} tiles of one row of one
   * phase of one pass (ground, then detail), a few dozen draw calls, so a frame never overshoots
   * its budget by much. Returns true when the job is finished.
   */
  private run(job: PaintJob, deadline: number): boolean {
    while (job.step < job.total) {
      const phase = Math.floor(job.step / STEPS_PER_PHASE);
      const within = job.step % STEPS_PER_PHASE;
      const pass = within < STEPS_PER_PHASE / 2 ? 0 : 1;
      const seg = pass === 0 ? within : within - STEPS_PER_PHASE / 2;
      const row = Math.floor(seg / SEGMENTS);
      const x0 = (seg % SEGMENTS) * SEGMENT;
      const ctx = job.ctxs[phase] as CanvasRenderingContext2D;
      if (pass === 0) this.paintGround(job.chunk, ctx, row, x0, phase);
      else this.paintDetail(job.chunk, ctx, row, x0);
      job.step++;
      if (job.step < job.total && performance.now() >= deadline) return false;
    }
    this.chunksBuilt++;
    return true;
  }

  private paintGround(
    chunk: Chunk,
    ctx: CanvasRenderingContext2D,
    y: number,
    x0: number,
    phase: number,
  ): void {
    for (let x = x0; x < x0 + SEGMENT; x++) {
      const i = tileIndex(x, y);
      const tx = chunk.cx * CHUNK_TILES + x;
      const ty = chunk.cy * CHUNK_TILES + y;
      const terrain = chunk.ground[i] as number;
      if (terrain === 0) continue;
      const hash = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 7;
      const base = this.bases.get(terrain) ?? this.grass;
      this.draw(ctx, base[hash % base.length] as number, x * TILE_PX, y * TILE_PX);
      const info = this.terrainInfo[terrain];
      if (info?.overlay) {
        const frames = this.blob.get(info.key) as number[];
        const idx = blobIndex(this.world.neighborMask(tx, ty, terrain));
        this.draw(
          ctx,
          frames[idx * info.overlay.phases + (phase % info.overlay.phases)] as number,
          x * TILE_PX,
          y * TILE_PX,
        );
      }
    }
  }

  private paintDetail(chunk: Chunk, ctx: CanvasRenderingContext2D, y: number, x0: number): void {
    for (let x = x0; x < x0 + SEGMENT; x++) {
      const d = chunk.detail[tileIndex(x, y)] as number;
      if (d === 0) continue;
      const h = this.tileFrame[d - 1] as number;
      const off = this.tileOffset[d - 1] as readonly [number, number];
      this.draw(
        ctx,
        h,
        x * TILE_PX + 8 - this.atlas.originX(h) + off[0],
        y * TILE_PX + 14 - this.atlas.originY(h) + off[1],
      );
    }
  }

  private hasTerrain(chunk: Chunk, id: number): boolean {
    for (let i = 0; i < chunk.ground.length; i++) if (chunk.ground[i] === id) return true;
    return false;
  }

  private draw(ctx: CanvasRenderingContext2D, handle: number, dx: number, dy: number): void {
    const a = this.atlas;
    ctx.drawImage(
      a.image(handle),
      a.srcX(handle),
      a.srcY(handle),
      a.width(handle),
      a.height(handle),
      dx,
      dy,
      a.width(handle),
      a.height(handle),
    );
  }

  /**
   * True if every neighbor of the chunk is loaded or lies beyond the edge of the region, so its
   * border tiles autotile correctly. A chunk is painted only then, and once painted it is kept
   * until it is dropped, because its neighbors stay loaded as long as it does.
   */
  private ready(cx: number, cy: number): boolean {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (!this.world.chunk(cx + dx, cy + dy) && !this.beyondEdge(cx + dx, cy + dy)) return false;
    return true;
  }

  /**
   * Spends up to `budgetMs` painting chunks around chunk (cx, cy), nearest first. Call once per
   * frame so chunks are painted before they scroll into view and no frame pays for more than the
   * budget. A chunk that is half painted keeps its place until the next call.
   */
  pump(cx: number, cy: number, budgetMs: number): void {
    const deadline = performance.now() + budgetMs;
    for (;;) {
      if (!this.job) {
        let best: Chunk | null = null;
        let bestD = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const c = this.world.chunk(cx + dx, cy + dy);
            if (!c || this.cache.has(`${c.cx},${c.cy}`) || !this.ready(c.cx, c.cy)) continue;
            const d = Math.abs(dx) + Math.abs(dy);
            if (d < bestD) {
              best = c;
              bestD = d;
            }
          }
        }
        if (!best) return;
        this.job = this.begin(best);
      }
      if (!this.run(this.job, deadline)) return;
      this.cache.set(`${this.job.chunk.cx},${this.job.chunk.cy}`, this.job.canvases);
      this.job = null;
      if (performance.now() >= deadline) return;
    }
  }

  /** Forgets a chunk's painted layers, when the chunk leaves memory. */
  drop(cx: number, cy: number): void {
    const list = this.cache.get(`${cx},${cy}`);
    if (list) this.pool.push(...list);
    this.cache.delete(`${cx},${cy}`);
    if (this.job && this.job.chunk.cx === cx && this.job.chunk.cy === cy) {
      this.pool.push(...this.job.canvases);
      this.job = null;
    }
  }

  private canvasFor(cx: number, cy: number, phase: number): HTMLCanvasElement | null {
    const key = `${cx},${cy}`;
    let list = this.cache.get(key);
    if (!list) {
      const chunk = this.world.chunk(cx, cy);
      if (!chunk) return null;
      // Not painted in time: finish it now rather than show a hole. Counted, so a test can see it.
      const job = this.job && this.job.chunk === chunk ? this.job : this.begin(chunk);
      this.run(job, Infinity);
      if (this.job === job) this.job = null;
      this.stalls++;
      list = job.canvases;
      this.cache.set(key, list);
    }
    return list[phase % list.length] ?? null;
  }

  /**
   * Queues everything visible: one blit per visible chunk, plus sprites for object and overhead
   * tiles in view. `phase` is the global animation phase (for example floor(time / 500)).
   * `target` is the entity, in world px, whose position fades overhead tiles above it.
   */
  drawVisible(
    r: Renderer,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    phase: number,
    target: { x: number; y: number } | null,
    dtMs: number,
  ): void {
    this.pump(
      Math.floor((camX + viewW / 2) / CHUNK_PX),
      Math.floor((camY + viewH / 2) / CHUNK_PX),
      // Never below half a millisecond, so painting always moves on even when frames are heavy.
      Math.max(0.5, Math.min(this.budgetMs(), WORLD_TUNABLES.paintFrameCapMs - this.lastFrameMs)),
    );
    const cx0 = Math.floor(camX / CHUNK_PX);
    const cy0 = Math.floor(camY / CHUNK_PX);
    const cx1 = Math.floor((camX + viewW - 1) / CHUNK_PX);
    const cy1 = Math.floor((camY + viewH - 1) / CHUNK_PX);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const canvas = this.canvasFor(cx, cy, phase);
        if (canvas) r.drawBlit(Layer.Ground, canvas, cx * CHUNK_PX, cy * CHUNK_PX);
      }
    }
    // Overhead sprites reach up to 32 px above their tile, so scan a few extra rows below the view.
    const tx0 = Math.floor(camX / TILE_PX) - 2;
    const tx1 = Math.floor((camX + viewW) / TILE_PX) + 2;
    const ty0 = Math.floor(camY / TILE_PX) - 1;
    const ty1 = Math.floor((camY + viewH) / TILE_PX) + 4;
    let chunk: Chunk | undefined;
    let chunkX = NaN;
    let chunkY = NaN;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const cx = Math.floor(tx / CHUNK_TILES);
        const cy = Math.floor(ty / CHUNK_TILES);
        if (cx !== chunkX || cy !== chunkY) {
          chunkX = cx;
          chunkY = cy;
          chunk = this.world.chunk(cx, cy);
        }
        if (!chunk) continue;
        const i = tileIndex(tx - chunk.cx * CHUNK_TILES, ty - chunk.cy * CHUNK_TILES);
        const ax = tx * TILE_PX + 8;
        const ay = ty * TILE_PX + 14;
        const o = chunk.object[i] as number;
        if (o !== 0) {
          const anim = this.tileAnim[o - 1] as number;
          const handle =
            anim >= 0
              ? this.atlas.animFrame(anim, phase * 500 + ((tx * 131 + ty * 71) % 400))
              : (this.tileFrame[o - 1] as number);
          r.drawSprite(Layer.Objects, handle, ax, ay);
        }
        const h = chunk.overhead[i] as number;
        if (h !== 0) {
          const off = this.tileOffset[h - 1] as readonly [number, number];
          const oy = ay + off[1];
          const covering =
            target !== null &&
            Math.abs(target.x - ax) < 14 &&
            target.y - 8 > oy - 32 &&
            target.y - 8 < oy;
          const alpha = this.fader.step(ty * 100000 + tx, covering, dtMs);
          r.drawSprite(
            Layer.Overhead,
            this.tileFrame[h - 1] as number,
            ax + off[0],
            oy,
            false,
            alpha,
          );
        }
      }
    }
  }
}
