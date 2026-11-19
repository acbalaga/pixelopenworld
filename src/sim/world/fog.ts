/**
 * Fog of war (POW-M4-06). The map draws itself as the avatar walks. Fog is kept per block of
 * 4 x 4 tiles, one bit each. A chunk (32 tiles) is 8 x 8 blocks, so its fog is 8 bytes, written
 * as 16 hex characters. A chunk with no revealed block has no entry, and a fully revealed one is
 * the same 16 characters repeated, which compresses to almost nothing.
 *
 * Pure: no DOM, no clock, no randomness.
 */
import { MAP_BALANCE } from '../../content/balance/map';
import { CHUNK_TILES } from './chunk';
import { chunkKey } from './window';

/** Blocks along one chunk edge. */
export const BLOCKS_PER_CHUNK = CHUNK_TILES / MAP_BALANCE.blockTiles;

/** Fog bits by chunk key. Row `y` of a chunk is byte `y`, column `x` is bit `x`. */
export type Fog = Record<string, string>;

/** A fully revealed chunk. */
export const FULL_CHUNK = 'ff'.repeat(BLOCKS_PER_CHUNK);

/** Block coordinate of a tile coordinate. Rounds toward negative infinity. */
export function blockOf(tile: number): number {
  return Math.floor(tile / MAP_BALANCE.blockTiles);
}

/** Splits global block coordinates into the chunk and the position inside it. */
function locate(bx: number, by: number): { cx: number; cy: number; lx: number; ly: number } {
  const cx = Math.floor(bx / BLOCKS_PER_CHUNK);
  const cy = Math.floor(by / BLOCKS_PER_CHUNK);
  return { cx, cy, lx: bx - cx * BLOCKS_PER_CHUNK, ly: by - cy * BLOCKS_PER_CHUNK };
}

/** True once the block has been revealed. */
export function isRevealed(fog: Fog, bx: number, by: number): boolean {
  const { cx, cy, lx, ly } = locate(bx, by);
  const bits = fog[chunkKey(cx, cy)];
  if (!bits) return false;
  return ((parseInt(bits.slice(ly * 2, ly * 2 + 2), 16) >> lx) & 1) === 1;
}

/** Reveals a block. Returns true if it was hidden before. */
export function revealBlock(fog: Fog, bx: number, by: number): boolean {
  const { cx, cy, lx, ly } = locate(bx, by);
  const key = chunkKey(cx, cy);
  const bits = fog[key] ?? '00'.repeat(BLOCKS_PER_CHUNK);
  const row = parseInt(bits.slice(ly * 2, ly * 2 + 2), 16);
  if ((row >> lx) & 1) return false;
  const next = (row | (1 << lx)).toString(16).padStart(2, '0');
  fog[key] = bits.slice(0, ly * 2) + next + bits.slice(ly * 2 + 2);
  return true;
}

/**
 * Reveals every block whose centre lies within `radius` blocks of block (bx, by), skipping chunks
 * for which `exists` says no (outside the region). Returns how many blocks were new.
 */
export function revealDisc(
  fog: Fog,
  bx: number,
  by: number,
  radius: number,
  exists: (cx: number, cy: number) => boolean = () => true,
): number {
  let fresh = 0;
  const r2 = radius * radius + radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = bx + dx;
      const y = by + dy;
      if (!exists(Math.floor(x / BLOCKS_PER_CHUNK), Math.floor(y / BLOCKS_PER_CHUNK))) continue;
      if (revealBlock(fog, x, y)) fresh++;
    }
  }
  return fresh;
}

/** The fog bytes of one chunk, eight rows. All zero when the chunk has none. */
export function chunkBits(fog: Fog, cx: number, cy: number): Uint8Array {
  const out = new Uint8Array(BLOCKS_PER_CHUNK);
  const bits = fog[chunkKey(cx, cy)];
  if (bits)
    for (let i = 0; i < BLOCKS_PER_CHUNK; i++) out[i] = parseInt(bits.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Number of revealed blocks. */
export function countRevealed(fog: Fog): number {
  let n = 0;
  for (const bits of Object.values(fog))
    for (let i = 0; i < BLOCKS_PER_CHUNK; i++) {
      let v = parseInt(bits.slice(i * 2, i * 2 + 2), 16);
      while (v) {
        n += v & 1;
        v >>= 1;
      }
    }
  return n;
}

/** Reveal radius in blocks for a Cartography rank in points. */
export function revealRadius(points: number): number {
  let r: number = MAP_BALANCE.radius[0].blocks;
  for (const row of MAP_BALANCE.radius) if (points >= row.from) r = row.blocks;
  return r;
}

/** True if the text is a well formed fog entry. Used by the loader to reject a damaged save. */
export function validFogBits(bits: unknown): bits is string {
  return typeof bits === 'string' && /^[0-9a-f]{16}$/.test(bits);
}

/**
 * Where a rumor mark is drawn. The true spot is moved by a fixed amount for this save and this
 * rumor: the same direction and ratio every time, scaled by how far Cartography has come. At
 * `preciseAt` points the offset is zero.
 */
export function rumorMark(
  seed: number,
  id: string,
  x: number,
  y: number,
  points: number,
): { x: number; y: number } {
  const R = MAP_BALANCE.rumor;
  const left = Math.max(0, R.preciseAt - points) / R.preciseAt;
  if (left === 0) return { x, y };
  const h = hash(`${seed >>> 0}:${id}`);
  const u = ((h & 0xffff) / 0xffff) * 2 - 1;
  const v = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  return {
    x: x + Math.round(u * R.maxOffsetTiles * left),
    y: y + Math.round(v * R.maxOffsetTiles * left),
  };
}

/** A small deterministic string hash (FNV-1a, 32 bit, with a final mix). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}
