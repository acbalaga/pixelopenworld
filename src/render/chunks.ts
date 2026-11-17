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

  private paint(chunk: Chunk): HTMLCanvasElement[] {
    const phases = TERRAINS.reduce(
      (m, t) => (t.overlay && this.hasTerrain(chunk, t.id) ? Math.max(m, t.overlay.phases) : m),
      1,
    );
    const out: HTMLCanvasElement[] = [];
    for (let phase = 0; phase < phases; phase++) {
      const canvas = document.createElement('canvas');
      canvas.width = CHUNK_PX;
      canvas.height = CHUNK_PX;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error('2d context unavailable');
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < CHUNK_TILES; y++) {
        for (let x = 0; x < CHUNK_TILES; x++) {
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
      for (let y = 0; y < CHUNK_TILES; y++) {
        for (let x = 0; x < CHUNK_TILES; x++) {
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
      out.push(canvas);
    }
    this.chunksBuilt++;
    return out;
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
   * Paints at most one missing chunk in the ring around chunk (cx, cy). Call once per frame so
   * chunks are ready before they scroll into view and no frame pays for more than one.
   */
  warm(cx: number, cy: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (this.cache.has(`${cx + dx},${cy + dy}`) || !this.world.chunk(cx + dx, cy + dy))
          continue;
        this.canvasFor(cx + dx, cy + dy, 0);
        return;
      }
    }
  }

  private canvasFor(cx: number, cy: number, phase: number): HTMLCanvasElement | null {
    const key = `${cx},${cy}`;
    let list = this.cache.get(key);
    if (!list) {
      const chunk = this.world.chunk(cx, cy);
      if (!chunk) return null;
      list = this.paint(chunk);
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
    this.warm(Math.floor((camX + viewW / 2) / CHUNK_PX), Math.floor((camY + viewH / 2) / CHUNK_PX));
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
