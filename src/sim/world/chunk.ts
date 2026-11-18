/** Chunk data: 32 x 32 tiles, four layers, a collision grid and an object list. */

/** Tiles per chunk edge. */
export const CHUNK_TILES = 32;
const N = CHUNK_TILES * CHUNK_TILES;

/** Collision values in the grid. */
export const Solid = { None: 0, Full: 1, Water: 2 } as const;

/** A placed object: a spawn point, sign or similar, by tile position within the chunk. */
export interface ChunkObject {
  x: number;
  y: number;
  /** Stable content id, for example `spawn.player`. */
  kind: string;
}

/** One chunk. Layer values index the tileset (0 is empty); ground holds terrain ids. */
export interface Chunk {
  cx: number;
  cy: number;
  ground: Uint16Array;
  detail: Uint16Array;
  object: Uint16Array;
  overhead: Uint16Array;
  collision: Uint8Array;
  /** Elevation band per tile (0 to 9), from the region spec. Version 1 files decode as all 0. */
  elevation: Uint8Array;
  objects: ChunkObject[];
}

/** An empty chunk at chunk coordinates (cx, cy). */
export function createChunk(cx: number, cy: number): Chunk {
  return {
    cx,
    cy,
    ground: new Uint16Array(N),
    detail: new Uint16Array(N),
    object: new Uint16Array(N),
    overhead: new Uint16Array(N),
    collision: new Uint8Array(N),
    elevation: new Uint8Array(N),
    objects: [],
  };
}

/** Index of tile (x, y) within a chunk's arrays. */
export function tileIndex(x: number, y: number): number {
  return y * CHUNK_TILES + x;
}

const MAGIC = 0x434f5750; // "PWOC" little endian
/** Written by the encoder. Version 1 (no elevation layer) still decodes. */
const VERSION = 2;
const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Binary format, little endian: magic u32, version u8, cx i16, cy i16, then the four u16 layers
 * (ground, detail, object, overhead) of 1024 entries each, the collision grid of 1024 u8, then
 * object count u16 and per object x u8, y u8, kind length u8, kind utf8. Version 2 appends the
 * elevation grid of 1024 u8 after the objects. Version 1 ends after the objects.
 */
export function encodeChunk(c: Chunk): Uint8Array {
  const kinds = c.objects.map((o) => enc.encode(o.kind));
  for (const k of kinds) if (k.length > 255) throw new Error('object kind too long');
  const size =
    4 +
    1 +
    2 +
    2 +
    4 * N * 2 +
    N +
    2 +
    c.objects.reduce((s, _o, i) => s + 3 + (kinds[i] as Uint8Array).length, 0) +
    N;
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  let p = 0;
  v.setUint32(p, MAGIC, true);
  p += 4;
  v.setUint8(p++, VERSION);
  v.setInt16(p, c.cx, true);
  p += 2;
  v.setInt16(p, c.cy, true);
  p += 2;
  for (const layer of [c.ground, c.detail, c.object, c.overhead]) {
    for (let i = 0; i < N; i++) {
      v.setUint16(p, layer[i] as number, true);
      p += 2;
    }
  }
  out.set(c.collision, p);
  p += N;
  v.setUint16(p, c.objects.length, true);
  p += 2;
  c.objects.forEach((o, i) => {
    const k = kinds[i] as Uint8Array;
    v.setUint8(p++, o.x);
    v.setUint8(p++, o.y);
    v.setUint8(p++, k.length);
    out.set(k, p);
    p += k.length;
  });
  out.set(c.elevation, p);
  return out;
}

/** Decodes {@link encodeChunk} output. Throws on a bad header or truncated data. */
export function decodeChunk(bytes: Uint8Array): Chunk {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 11 || v.getUint32(0, true) !== MAGIC) throw new Error('not a chunk file');
  const version = v.getUint8(4);
  if (version !== 1 && version !== 2) throw new Error(`unsupported chunk version ${version}`);
  let p = 5;
  const c = createChunk(v.getInt16(p, true), v.getInt16(p + 2, true));
  p += 4;
  const need = p + 4 * N * 2 + N + 2;
  if (bytes.length < need) throw new Error('chunk file truncated');
  for (const layer of [c.ground, c.detail, c.object, c.overhead]) {
    for (let i = 0; i < N; i++) {
      layer[i] = v.getUint16(p, true);
      p += 2;
    }
  }
  c.collision.set(bytes.subarray(p, p + N));
  p += N;
  const n = v.getUint16(p, true);
  p += 2;
  for (let i = 0; i < n; i++) {
    if (p + 3 > bytes.length) throw new Error('chunk file truncated');
    const x = v.getUint8(p++);
    const y = v.getUint8(p++);
    const len = v.getUint8(p++);
    if (p + len > bytes.length) throw new Error('chunk file truncated');
    c.objects.push({ x, y, kind: dec.decode(bytes.subarray(p, p + len)) });
    p += len;
  }
  if (version === 2) {
    if (p + N > bytes.length) throw new Error('chunk file truncated');
    c.elevation.set(bytes.subarray(p, p + N));
  }
  return c;
}
