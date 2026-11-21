import { SKILLS } from '../../src/content/skills';
import { FIXTURES } from '../../src/content/world/fixtures';
import type { RegionSpec } from '../../src/content/world/regions/types';
import { Solid, tileIndex, CHUNK_TILES, type Chunk } from '../../src/sim/world/chunk';
import type { WorldFiles } from './bake';
import { decodeChunk } from '../../src/sim/world/chunk';

/** The shortest a landmark may be to show above the trees from afar, in tiles. */
export const MIN_LANDMARK_HEIGHT = 8;
/** A landmark must be seen from this many chunks away, along at least two of the eight directions. */
export const SIGHT_CHUNKS = 2;
/** Streets are at least this wide, so a thumb steered walk does not snag (design/02). */
export const MIN_STREET = 3;

/** Object kinds a civic square may not hold: stations, beds, shop counters and the cook pot. */
function barredInSquare(kind: string): boolean {
  const type = FIXTURES[kind]?.type;
  return (
    type === 'station' || type === 'bed' || kind === 'npc.shopkeeper' || kind === 'prop.camp_pot'
  );
}

/** A baked region's chunks, looked up by tile. */
class Baked {
  private chunks = new Map<string, Chunk>();
  constructor(
    region: string,
    files: WorldFiles,
    readonly w: number,
    readonly h: number,
  ) {
    for (const [name, v] of files) {
      const m = new RegExp(`^${region}/chunk-(\\d+)-(\\d+)\\.bin$`).exec(name);
      if (m) this.chunks.set(`${m[1]},${m[2]}`, decodeChunk(v as Uint8Array));
    }
  }
  chunk(tx: number, ty: number): Chunk | undefined {
    return this.chunks.get(`${Math.floor(tx / CHUNK_TILES)},${Math.floor(ty / CHUNK_TILES)}`);
  }
  index(tx: number, ty: number): number {
    return tileIndex(tx % CHUNK_TILES, ty % CHUNK_TILES);
  }
  collision(tx: number, ty: number): number {
    const c = this.chunk(tx, ty);
    return c ? (c.collision[this.index(tx, ty)] as number) : Solid.Full;
  }
  elevation(tx: number, ty: number): number {
    const c = this.chunk(tx, ty);
    return c ? (c.elevation[this.index(tx, ty)] as number) : 0;
  }
  /** Every placed object by world tile. */
  objects(): { kind: string; x: number; y: number }[] {
    const out: { kind: string; x: number; y: number }[] = [];
    for (const c of this.chunks.values())
      for (const o of c.objects)
        out.push({ kind: o.kind, x: c.cx * CHUNK_TILES + o.x, y: c.cy * CHUNK_TILES + o.y });
    return out;
  }
}

/**
 * Checks a baked region against its spec (POW-M4-04). Returns every problem found:
 * - every Waystone point has a Waystone object, and every Waystone object is listed;
 * - a wake point stands on open ground;
 * - a civic square holds no crafting station, bed or shop counter;
 * - a street is at least 3 tiles wide and has nothing solid in it;
 * - every landmark is tall enough, and can be seen from two chunks away in at least two directions
 *   (nothing higher than its foot stands in the way along the line).
 */
export function validateRegion(spec: RegionSpec, files: WorldFiles): string[] {
  const errors: string[] = [];
  const at = (m: string): string => `${spec.id}: ${m}`;
  const baked = new Baked(spec.id, files, spec.chunks.w * CHUNK_TILES, spec.chunks.h * CHUNK_TILES);
  const objects = baked.objects();

  for (const w of spec.waystones)
    if (!objects.some((o) => o.kind === 'fixture.waystone' && o.x === w.x && o.y === w.y))
      errors.push(at(`Waystone ${w.id} at ${w.x}, ${w.y} has no Waystone object`));
  const stones = objects.filter((o) => o.kind === 'fixture.waystone');
  for (const o of stones)
    if (!spec.waystones.some((w) => w.x === o.x && w.y === o.y))
      errors.push(at(`a Waystone object at ${o.x}, ${o.y} is not listed in waystones`));

  for (const p of spec.wakePoints)
    if (baked.collision(p.x, p.y) !== Solid.None)
      errors.push(at(`wake point ${p.id} at ${p.x}, ${p.y} is not open ground`));

  for (const d of spec.districts ?? []) {
    if (d.kind === 'square')
      for (const o of objects)
        if (
          o.x >= d.x &&
          o.x < d.x + d.w &&
          o.y >= d.y &&
          o.y < d.y + d.h &&
          barredInSquare(o.kind)
        )
          errors.push(
            at(`${o.kind} at ${o.x}, ${o.y} sits in the square '${d.id}', which is civic only`),
          );
    if (d.kind === 'street') {
      if (Math.min(d.w, d.h) < MIN_STREET)
        errors.push(
          at(`street '${d.id}' is ${Math.min(d.w, d.h)} tiles wide, under ${MIN_STREET}`),
        );
      for (let y = d.y; y < d.y + d.h; y++)
        for (let x = d.x; x < d.x + d.w; x++)
          if (baked.collision(x, y) !== Solid.None) {
            errors.push(at(`street '${d.id}' is blocked at ${x}, ${y}`));
            y = d.y + d.h;
            break;
          }
    }
  }

  // Landmarks. A region that declares no heights opts out (the baker's own fixtures do).
  for (const l of spec.landmarkHeights ? spec.landmarks : []) {
    const height = spec.landmarkHeights?.[l.id];
    if (height === undefined) {
      errors.push(at(`landmark ${l.id} has no declared height`));
      continue;
    }
    if (height < MIN_LANDMARK_HEIGHT)
      errors.push(at(`landmark ${l.id} is ${height} tiles tall, under ${MIN_LANDMARK_HEIGHT}`));
    const foot = baked.elevation(l.x, l.y + height - 1);
    let clear = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const dist = SIGHT_CHUNKS * CHUNK_TILES;
      let ok = true;
      let inside = true;
      for (let k = 4; k <= dist; k += 2) {
        const x = l.x + dx * k;
        const y = l.y + dy * k;
        if (x < 0 || y < 0 || x >= baked.w || y >= baked.h) {
          inside = false;
          break;
        }
        // A rise that stands more than a step above the landmark's foot hides it.
        if (baked.elevation(x, y) > foot + 1) {
          ok = false;
          break;
        }
      }
      if (ok && inside) clear++;
    }
    if (clear < 2)
      errors.push(
        at(
          `landmark ${l.id} can be seen from two chunks away in only ${clear} direction(s), needs 2`,
        ),
      );
  }

  errors.push(...validateDiscoverables(spec));
  errors.push(...validatePois(spec, baked));
  errors.push(...validateSecrets(spec));
  return errors;
}

/** At least a fifth of a region's secrets are reached by a non-combat skill (design/02). */
function validateSecrets(spec: RegionSpec): string[] {
  const list = spec.secrets;
  if (!list) return [];
  const quiet = list.filter((s) => {
    const fam = s.skill ? SKILLS[s.skill]?.family : undefined;
    return fam !== undefined && fam !== 'arms' && fam !== 'magic';
  });
  return quiet.length * 5 >= list.length
    ? []
    : [
        `${spec.id}: only ${quiet.length} of ${list.length} secrets list a non-combat skill route, needs a fifth`,
      ];
}

/** A point of interest stands on open ground. */
function validatePois(spec: RegionSpec, baked: Baked): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of spec.pois ?? []) {
    if (seen.has(p.id)) out.push(`${spec.id}: point of interest ${p.id} is listed twice`);
    seen.add(p.id);
    if (baked.collision(p.x, p.y) !== Solid.None)
      out.push(`${spec.id}: ${p.id} at ${p.x}, ${p.y} is not open ground`);
  }
  return out;
}

/** Settlement stamps, which count as a discoverable for the chunk they stand in. */
const SETTLEMENT_STAMPS = new Set(['hearthford', 'millbrook', 'reedmouth', 'stonecrop']);

/**
 * Every land chunk holds at least one discoverable (regions/01 section 12): a point of interest,
 * a node cluster (two or more nodes), a settlement, a Waystone or a landmark. Sea, the true wall
 * of the Crown and the underground rows are not land. A chunk with none must be listed in
 * `pendingDiscoverables`, and a listed one that has one must come off the list.
 */
function validateDiscoverables(spec: RegionSpec): string[] {
  if (!spec.pois) return [];
  const rows = Math.min(spec.chunks.h, Math.floor(spec.biomes.length / 4));
  const cell = (cx: number, cy: number, x: number, y: number): [string, string] => [
    spec.biomes[cy * 4 + y]?.[cx * 4 + x] ?? 'x',
    spec.elevation[cy * 4 + y]?.[cx * 4 + x] ?? '0',
  ];
  const isLand = (cx: number, cy: number): boolean => {
    let dry = 0;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const [b, e] = cell(cx, cy, x, y);
        if (spec.biomeLegend[b] !== 'sea' && Number(e) < 3) dry++;
      }
    return dry >= 8;
  };
  const where = (p: { x: number; y: number }): string =>
    `${Math.floor(p.x / CHUNK_TILES)},${Math.floor(p.y / CHUNK_TILES)}`;
  const has = new Map<string, number>();
  const bump = (k: string, n = 1): void => void has.set(k, (has.get(k) ?? 0) + n);
  for (const p of spec.pois ?? []) bump(where(p), 2);
  for (const p of [...spec.waystones, ...spec.landmarks]) bump(where(p), 2);
  for (const pl of spec.placements) {
    if (pl.stamp !== undefined && SETTLEMENT_STAMPS.has(pl.stamp)) bump(where(pl), 2);
    else if (pl.kind.startsWith('node.')) bump(where(pl));
  }
  const pending = new Set(spec.pendingDiscoverables ?? []);
  const out: string[] = [];
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < spec.chunks.w; cx++) {
      if (!isLand(cx, cy)) continue;
      const key = `${cx},${cy}`;
      const ok = (has.get(key) ?? 0) >= 2;
      if (!ok && !pending.has(key))
        out.push(`${spec.id}: chunk ${key} holds no discoverable, and is not listed as pending`);
      if (ok && pending.has(key))
        out.push(
          `${spec.id}: chunk ${key} holds a discoverable now, so remove it from pendingDiscoverables`,
        );
    }
  for (const key of pending) {
    const [cx, cy] = key.split(',').map(Number) as [number, number];
    if (!isLand(cx, cy)) out.push(`${spec.id}: pending chunk ${key} is not land`);
  }
  return out;
}
