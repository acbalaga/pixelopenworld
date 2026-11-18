import { CHUNK_TILES, createChunk, tileIndex, type Chunk } from './chunk';
import { BakeError } from './bakeError';

/**
 * Stamp format v0 (minimal; M4 extends it). A stamp is a grid of characters plus a legend.
 * Each legend entry names the ground terrain and, optionally, tile ids for the detail, object
 * and overhead layers of that cell. The grid's top left is world tile (0, 0). The grid size
 * must be a multiple of the chunk size (32). Collision is derived from `collisionOf`.
 */
export interface StampCell {
  ground: number;
  detail?: number;
  object?: number;
  overhead?: number;
}

/** A stamp: legend plus rows of equal length. */
export interface Stamp {
  id: string;
  legend: Readonly<Record<string, StampCell>>;
  rows: readonly string[];
  /** Objects by world tile, for example spawn points. */
  objects?: readonly { x: number; y: number; kind: string }[];
}

/** Collision value of a cell, from the ground terrain and the object tile. */
export type CollisionOf = (cell: StampCell) => number;

/** Builds the chunks a stamp covers. Throws with the row and column of any bad cell. */
export function buildChunks(stamp: Stamp, collisionOf: CollisionOf): Chunk[] {
  const h = stamp.rows.length;
  const w = stamp.rows[0]?.length ?? 0;
  if (w === 0 || w % CHUNK_TILES !== 0 || h % CHUNK_TILES !== 0) {
    throw new Error(`stamp ${stamp.id}: size ${w}x${h} is not a multiple of ${CHUNK_TILES}`);
  }
  const chunks = new Map<string, Chunk>();
  stamp.rows.forEach((row, y) => {
    if (row.length !== w)
      throw new Error(`stamp ${stamp.id} row ${y}: width ${row.length}, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const cell = stamp.legend[row[x] as string];
      if (!cell)
        throw new Error(`stamp ${stamp.id} row ${y} col ${x}: unknown character '${row[x]}'`);
      const cx = Math.floor(x / CHUNK_TILES);
      const cy = Math.floor(y / CHUNK_TILES);
      const key = `${cx},${cy}`;
      let c = chunks.get(key);
      if (!c) {
        c = createChunk(cx, cy);
        chunks.set(key, c);
      }
      const i = tileIndex(x - cx * CHUNK_TILES, y - cy * CHUNK_TILES);
      c.ground[i] = cell.ground;
      c.detail[i] = cell.detail ?? 0;
      c.object[i] = cell.object ?? 0;
      c.overhead[i] = cell.overhead ?? 0;
      c.collision[i] = collisionOf(cell);
    }
  });
  for (const o of stamp.objects ?? []) {
    const c = chunks.get(`${Math.floor(o.x / CHUNK_TILES)},${Math.floor(o.y / CHUNK_TILES)}`);
    if (!c)
      throw new Error(`stamp ${stamp.id}: object ${o.kind} at ${o.x},${o.y} is outside the stamp`);
    c.objects.push({ x: o.x - c.cx * CHUNK_TILES, y: o.y - c.cy * CHUNK_TILES, kind: o.kind });
  }
  return [...chunks.values()].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
}

// ---------------------------------------------------------------------------------------------
// Stamp format v2 (POW-M4-02). v0 above stays readable for the slice map until POW-M4-04.
// ---------------------------------------------------------------------------------------------

/** How a stamp may be turned when placed. `90` allows all four quarter turns, `mirror` a flip. */
export type RotateRule = 'none' | '90' | 'mirror';
/** A turn a placement asks for. */
export type Rotation = 0 | 90 | 180 | 270 | 'mirror';

/** The four tile layers a stamp can author. A space means "nothing here, leave what is below". */
export interface StampLayers {
  ground?: readonly string[];
  detail?: readonly string[];
  object?: readonly string[];
  overhead?: readonly string[];
}

/**
 * A v2 stamp: one legend shared by every layer, each layer its own rows. A legend character gives
 * the layer it appears in the matching value of its cell (a `ground` row reads `ground`, an
 * `object` row reads `object`, and so on). The anchor character marks the tile a placement
 * coordinate refers to. It may appear in any layer and counts as a space there.
 */
export interface StampV2 {
  version: 2;
  id: string;
  legend: Readonly<Record<string, StampCell>>;
  layers: StampLayers;
  /** Defaults to `@`. Without one in the rows the anchor is the top left tile. */
  anchorChar?: string;
  /** Alternate rows: a variant replaces the layers it names. */
  variants?: Readonly<Record<string, StampLayers>>;
  rotate?: RotateRule;
  /** Objects in stamp coordinates. */
  objects?: readonly { x: number; y: number; kind: string }[];
  /** Doors that join an interior. The baker places a `door.<interior>` object on each. */
  doors?: readonly { x: number; y: number; interior: string }[];
}

/** A stamp after variant and rotation: cells in row-major order, null where it leaves things alone. */
export interface ResolvedStamp {
  id: string;
  w: number;
  h: number;
  cells: (StampCell | null)[];
  objects: { x: number; y: number; kind: string }[];
  doors: { x: number; y: number; interior: string }[];
  anchor: { x: number; y: number };
}

const LAYER_NAMES = ['ground', 'detail', 'object', 'overhead'] as const;

/** Resolves a v2 stamp for one placement. Throws a {@link BakeError} naming layer and coordinate. */
export function resolveStamp(
  stamp: StampV2,
  opts: { variant?: string; rotate?: Rotation } = {},
): ResolvedStamp {
  const src = `stamp ${stamp.id}`;
  let layers: StampLayers = stamp.layers;
  if (opts.variant !== undefined) {
    const v = stamp.variants?.[opts.variant];
    if (!v) throw new BakeError(src, 'variant', `no variant named '${opts.variant}'`);
    layers = { ...stamp.layers, ...v };
  }
  const rule = stamp.rotate ?? 'none';
  const rot = opts.rotate ?? 0;
  const allowed =
    rot === 0 ||
    (rule === '90' && (rot === 90 || rot === 180 || rot === 270)) ||
    (rule === 'mirror' && rot === 'mirror');
  if (!allowed)
    throw new BakeError(src, 'rotate', `rotation ${rot} is not allowed (rule '${rule}')`);

  const anchorChar = stamp.anchorChar ?? '@';
  let w = 0;
  let h = 0;
  let anchor: { x: number; y: number } | null = null;
  for (const name of LAYER_NAMES) {
    const rows = layers[name];
    if (!rows) continue;
    if (h === 0) {
      h = rows.length;
      w = rows[0]?.length ?? 0;
    } else if (rows.length !== h) {
      throw new BakeError(src, name, `has ${rows.length} rows, expected ${h}`);
    }
  }
  if (w === 0 || h === 0) throw new BakeError(src, 'layers', 'has no rows');
  let cells: (StampCell | null)[] = Array(w * h).fill(null);
  for (const name of LAYER_NAMES) {
    const rows = layers[name];
    if (!rows) continue;
    rows.forEach((row, y) => {
      if (row.length !== w)
        throw new BakeError(src, name, `row has width ${row.length}, expected ${w}`, {
          x: row.length,
          y,
        });
      for (let x = 0; x < w; x++) {
        const ch = row[x] as string;
        if (ch === anchorChar) {
          if (anchor) throw new BakeError(src, name, 'a second anchor character', { x, y });
          anchor = { x, y };
          continue;
        }
        if (ch === ' ') continue;
        const def = stamp.legend[ch];
        if (!def) throw new BakeError(src, name, `unknown character '${ch}'`, { x, y });
        const value = def[name];
        if (value === undefined)
          throw new BakeError(src, name, `character '${ch}' has no ${name} value`, { x, y });
        const prev = cells[y * w + x] ?? { ground: 0 };
        cells[y * w + x] = { ...prev, [name]: value };
      }
    });
  }
  const a = anchor ?? { x: 0, y: 0 };
  let objects = (stamp.objects ?? []).map((o) => ({ ...o }));
  let doors = (stamp.doors ?? []).map((d) => ({ ...d }));
  for (const o of [...objects, ...doors]) {
    if (o.x < 0 || o.y < 0 || o.x >= w || o.y >= h)
      throw new BakeError(src, 'objects', `placement is outside the stamp (${w}x${h})`, {
        x: o.x,
        y: o.y,
      });
  }
  let pos = { ...a };
  const turn = (): void => {
    const nc: (StampCell | null)[] = Array(w * h).fill(null);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) nc[x * h + (h - 1 - y)] = cells[y * w + x] ?? null;
    const t = (p: { x: number; y: number }): void => {
      const x = p.x;
      p.x = h - 1 - p.y;
      p.y = x;
    };
    objects.forEach(t);
    doors.forEach(t);
    t(pos);
    cells = nc;
    [w, h] = [h, w];
  };
  if (rot === 'mirror') {
    const nc: (StampCell | null)[] = Array(w * h).fill(null);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) nc[y * w + (w - 1 - x)] = cells[y * w + x] ?? null;
    cells = nc;
    objects = objects.map((o) => ({ ...o, x: w - 1 - o.x }));
    doors = doors.map((d) => ({ ...d, x: w - 1 - d.x }));
    pos = { x: w - 1 - pos.x, y: pos.y };
  } else for (let i = 0; i < rot / 90; i++) turn();
  return { id: stamp.id, w, h, cells, objects, doors, anchor: pos };
}
