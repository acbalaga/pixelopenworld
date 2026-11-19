/**
 * The map picture (POW-M4-06). One cell is 2 x 2 tiles, so a chunk is 16 x 16 cells, and a fog
 * block (4 x 4 tiles) is 2 x 2 cells. The picture is made from chunk data in a hand-drawn style:
 * ink along shores and building edges, a two-tone stipple on grass, trees and water. No DOM
 * here: {@link MapImage.paint} fills a byte array, which the Menu and the minimap put on a canvas.
 *
 * Only ground the avatar has uncovered is painted. A revealed block whose chunk has not been
 * loaded yet shows as plain remembered ground, and fills in when the chunk arrives.
 */
import { MAP_BALANCE } from '../content/balance/map';
import {
  CELL_COLOR,
  CELL_PRIORITY,
  Cell,
  MAP_PAPER,
  MAP_UNDRAWN,
  PALETTE_RGB,
  TILE_CELL,
  terrainCell,
} from '../content/world/mapStyle';
import { CHUNK_TILES, Solid, type Chunk } from '../sim/world/chunk';
import { chunkBits, type Fog } from '../sim/world/fog';
import { parseChunkKey } from '../sim/world/window';

/** Cells along a chunk edge. */
export const CELLS_PER_CHUNK = CHUNK_TILES / MAP_BALANCE.cellTiles;
const CELLS_PER_BLOCK = MAP_BALANCE.blockTiles / MAP_BALANCE.cellTiles;

export class MapImage {
  /** Size in cells. */
  readonly cw: number;
  readonly ch: number;
  private readonly cells: Uint8Array;
  private readonly loaded = new Set<number>();

  constructor(
    readonly chunksW: number,
    readonly chunksH: number,
  ) {
    this.cw = chunksW * CELLS_PER_CHUNK;
    this.ch = chunksH * CELLS_PER_CHUNK;
    this.cells = new Uint8Array(this.cw * this.ch);
  }

  private key(cx: number, cy: number): number {
    return cy * this.chunksW + cx;
  }

  /** True once the chunk's cells have been read. */
  hasChunk(cx: number, cy: number): boolean {
    return this.loaded.has(this.key(cx, cy));
  }

  /** Reads a chunk's cells. A chunk outside the picture is ignored. */
  setChunk(c: Chunk): void {
    if (c.cx < 0 || c.cy < 0 || c.cx >= this.chunksW || c.cy >= this.chunksH) return;
    const n = MAP_BALANCE.cellTiles;
    for (let y = 0; y < CELLS_PER_CHUNK; y++) {
      for (let x = 0; x < CELLS_PER_CHUNK; x++) {
        let best: number = Cell.Grass;
        for (let dy = 0; dy < n; dy++) {
          for (let dx = 0; dx < n; dx++) {
            const i = (y * n + dy) * CHUNK_TILES + (x * n + dx);
            const kinds = [
              c.collision[i] === Solid.Water ? Cell.Water : terrainCell(c.ground[i] as number),
              TILE_CELL[c.object[i] as number] as number,
              TILE_CELL[c.overhead[i] as number] as number,
              TILE_CELL[c.detail[i] as number] as number,
            ];
            for (const k of kinds)
              if ((CELL_PRIORITY[k] ?? 0) > (CELL_PRIORITY[best] ?? 0)) best = k;
          }
        }
        this.cells[(c.cy * CELLS_PER_CHUNK + y) * this.cw + c.cx * CELLS_PER_CHUNK + x] = best;
      }
    }
    this.loaded.add(this.key(c.cx, c.cy));
  }

  /** Chunks with uncovered ground whose cells have not been read yet. */
  missing(fog: Fog): { cx: number; cy: number }[] {
    const out: { cx: number; cy: number }[] = [];
    for (const key of Object.keys(fog)) {
      const c = parseChunkKey(key);
      if (
        c &&
        c.cx >= 0 &&
        c.cy >= 0 &&
        c.cx < this.chunksW &&
        c.cy < this.chunksH &&
        !this.hasChunk(c.cx, c.cy)
      )
        out.push(c);
    }
    return out;
  }

  private at(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.cw || y >= this.ch
      ? 0
      : (this.cells[y * this.cw + x] as number);
  }

  /**
   * Paints the cells of the window (x0, y0, w, h) into `out`, four bytes (RGBA) a cell, row by
   * row. Fog is transparent. A window may reach past the picture: those cells are transparent too.
   */
  paint(fog: Fog, x0: number, y0: number, w: number, h: number, out: Uint8ClampedArray): void {
    out.fill(0, 0, w * h * 4);
    const bitsOf = new Map<number, Uint8Array>();
    const seen = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= this.cw || y >= this.ch) return false;
      const cx = Math.floor(x / CELLS_PER_CHUNK);
      const cy = Math.floor(y / CELLS_PER_CHUNK);
      const k = this.key(cx, cy);
      let bits = bitsOf.get(k);
      if (!bits) bitsOf.set(k, (bits = chunkBits(fog, cx, cy)));
      const bx = Math.floor((x % CELLS_PER_CHUNK) / CELLS_PER_BLOCK);
      const by = Math.floor((y % CELLS_PER_CHUNK) / CELLS_PER_BLOCK);
      return (((bits[by] as number) >> bx) & 1) === 1;
    };
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = x0 + i;
        const y = y0 + j;
        if (!seen(x, y)) continue;
        const rgb = PALETTE_RGB[this.color(x, y, seen)] as readonly [number, number, number];
        const o = (j * w + i) * 4;
        out[o] = rgb[0];
        out[o + 1] = rgb[1];
        out[o + 2] = rgb[2];
        out[o + 3] = 255;
      }
    }
  }

  /** Palette index for one uncovered cell. */
  private color(x: number, y: number, seen: (x: number, y: number) => boolean): number {
    const kind = this.at(x, y);
    if (kind === Cell.Unknown) return MAP_UNDRAWN;
    const style = CELL_COLOR[kind];
    if (!style) return MAP_PAPER;
    // Ink where this kind meets another that is known: a shore, the foot of a wall.
    const edge =
      kind === Cell.Water || kind === Cell.Roof || kind === Cell.Wall || kind === Cell.Rock;
    if (edge) {
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ] as const) {
        const nk = this.at(x + dx, y + dy);
        if (nk !== Cell.Unknown && nk !== kind && seen(x + dx, y + dy)) return style.ink;
      }
    }
    // A fixed pattern, not noise: the same cell is always the same color.
    const stipple = ((x * 7 + y * 13) ^ (x >> 1) ^ (y >> 2)) & 7;
    if (style.alt !== undefined) {
      if (kind === Cell.Tree) return (x + y) & 1 ? style.fill : style.alt;
      if (stipple === 0) return style.alt;
    }
    return style.fill;
  }
}
