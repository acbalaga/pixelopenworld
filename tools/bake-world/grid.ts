import { CHUNK_TILES, Solid, createChunk, tileIndex, type Chunk } from '../../src/sim/world/chunk';
import type { StampCell } from '../../src/sim/world/stamp';
import { collisionOfCell } from '../bake-assets/world';

/** Why a tile is off limits to the fill generators. */
export const Protect = { Stamp: 1, Road: 2, River: 4, Bank: 8, Cliff: 16 } as const;

/** A whole region (or interior) as flat arrays, before it is cut into chunks. */
export class Grid {
  readonly ground: Uint16Array;
  readonly detail: Uint16Array;
  readonly object: Uint16Array;
  readonly overhead: Uint16Array;
  readonly elevation: Uint8Array;
  readonly protect: Uint8Array;
  readonly objects: { x: number; y: number; kind: string }[] = [];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    const n = w * h;
    this.ground = new Uint16Array(n);
    this.detail = new Uint16Array(n);
    this.object = new Uint16Array(n);
    this.overhead = new Uint16Array(n);
    this.elevation = new Uint8Array(n);
    this.protect = new Uint8Array(n);
  }

  /** Adds protection bits to tile index i. */
  mark(i: number, bits: number): void {
    this.protect[i] = (this.protect[i] ?? 0) | bits;
  }

  /** True if tile index i has any of the bits. */
  has(i: number, bits: number): boolean {
    return ((this.protect[i] ?? 0) & bits) !== 0;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  at(x: number, y: number): number {
    return y * this.w + x;
  }

  /** Clears everything above the ground of a tile (scatter, cliffs) when a road or river takes it. */
  clearAbove(x: number, y: number): void {
    const i = this.at(x, y);
    this.detail[i] = 0;
    this.object[i] = 0;
    this.overhead[i] = 0;
  }

  /** Writes a stamp cell. Only the layers the cell names change. */
  put(x: number, y: number, cell: StampCell): void {
    const i = this.at(x, y);
    if (cell.ground !== undefined && cell.ground !== 0) this.ground[i] = cell.ground;
    if (cell.detail !== undefined) this.detail[i] = cell.detail;
    if (cell.object !== undefined) this.object[i] = cell.object;
    if (cell.overhead !== undefined) this.overhead[i] = cell.overhead;
  }

  /** Cuts the grid into chunks. A tile with no ground is solid (the void around an interior). */
  toChunks(): Chunk[] {
    const out: Chunk[] = [];
    const cw = Math.ceil(this.w / CHUNK_TILES);
    const ch = Math.ceil(this.h / CHUNK_TILES);
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        const c = createChunk(cx, cy);
        for (let y = 0; y < CHUNK_TILES; y++) {
          for (let x = 0; x < CHUNK_TILES; x++) {
            const wx = cx * CHUNK_TILES + x;
            const wy = cy * CHUNK_TILES + y;
            const j = tileIndex(x, y);
            if (!this.inside(wx, wy)) {
              c.collision[j] = Solid.Full;
              continue;
            }
            const i = this.at(wx, wy);
            c.ground[j] = this.ground[i] as number;
            c.detail[j] = this.detail[i] as number;
            c.object[j] = this.object[i] as number;
            c.overhead[j] = this.overhead[i] as number;
            c.elevation[j] = this.elevation[i] as number;
            c.collision[j] =
              c.ground[j] === 0
                ? Solid.Full
                : collisionOfCell({
                    ground: c.ground[j] as number,
                    object: c.object[j] as number,
                  });
          }
        }
        out.push(c);
      }
    }
    for (const o of this.objects) {
      const c = out[Math.floor(o.y / CHUNK_TILES) * cw + Math.floor(o.x / CHUNK_TILES)];
      if (c)
        c.objects.push({ x: o.x - c.cx * CHUNK_TILES, y: o.y - c.cy * CHUNK_TILES, kind: o.kind });
    }
    for (const c of out)
      c.objects.sort((a, b) => a.y - b.y || a.x - b.x || (a.kind < b.kind ? -1 : 1));
    return out;
  }
}
