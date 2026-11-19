import { FIXTURES } from '../../src/content/world/fixtures';
import type { RegionSpec } from '../../src/content/world/regions/types';
import { Solid, tileIndex, CHUNK_TILES, type Chunk } from '../../src/sim/world/chunk';
import type { WorldFiles } from './bake';
import { ZONES, slotKind } from '../../src/content/creatures/rosters';
import { TILESET } from '../../src/content/world/tileset';
import { carveRivers, carveRoads } from './carve';
import { Grid, Protect } from './grid';
import { SAFE_TILES, spawnerOf, startsFights } from './spawnRules';
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
  /** The object layer tile id at a tile (0 for none). */
  objectTile(tx: number, ty: number): number {
    const c = this.chunk(tx, ty);
    return c ? (c.object[this.index(tx, ty)] as number) : 0;
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

  errors.push(...checkSpawners(spec, baked, objects));
  return errors;
}

/**
 * Spawner rules (POW-M4-05): every spawner kind is known; none that starts fights stands within
 * `SAFE_TILES` of a wake point, a road or a town wall; and every slot of every zone roster is
 * placed at least once, so no creature of the region doc is missing from the map.
 */
function checkSpawners(
  spec: RegionSpec,
  baked: Baked,
  objects: { kind: string; x: number; y: number }[],
): string[] {
  const errors: string[] = [];
  const at = (m: string): string => `${spec.id}: ${m}`;
  const spawners = objects.filter((o) => o.kind.startsWith('spawner.'));
  if (spawners.length === 0 && spec.zones.length === 0) return errors;
  // Roads are drawn again on a blank grid, so the check never depends on what the ground looks like.
  const roads = new Grid(baked.w, baked.h);
  carveRivers(spec, roads);
  carveRoads(spec, roads);
  const walls = new Set(
    ['h', 'v', 'post'].map((k) => TILESET.indexOf(`tile.wall_stone_${k}`) + 1).filter((i) => i > 0),
  );
  const r2 = SAFE_TILES * SAFE_TILES;
  for (const o of spawners) {
    const def = spawnerOf(o.kind);
    if (!def) {
      errors.push(at(`${o.kind} at ${o.x}, ${o.y} is not a known spawner`));
      continue;
    }
    if (!startsFights(def)) continue;
    for (const w of spec.wakePoints)
      if ((w.x - o.x) ** 2 + (w.y - o.y) ** 2 < r2)
        errors.push(
          at(`${o.kind} at ${o.x}, ${o.y} is within ${SAFE_TILES} tiles of wake point ${w.id}`),
        );
    let hit: string | null = null;
    for (
      let y = Math.max(0, o.y - SAFE_TILES);
      y <= Math.min(baked.h - 1, o.y + SAFE_TILES) && !hit;
      y++
    )
      for (
        let x = Math.max(0, o.x - SAFE_TILES);
        x <= Math.min(baked.w - 1, o.x + SAFE_TILES);
        x++
      ) {
        if ((x - o.x) ** 2 + (y - o.y) ** 2 >= r2) continue;
        if (roads.has(roads.at(x, y), Protect.Road)) {
          hit = `a road at ${x}, ${y}`;
          break;
        }
        if (walls.has(baked.objectTile(x, y))) {
          hit = `the town wall at ${x}, ${y}`;
          break;
        }
      }
    if (hit) errors.push(at(`${o.kind} at ${o.x}, ${o.y} is within ${SAFE_TILES} tiles of ${hit}`));
  }
  const placedKinds = new Set(spawners.map((o) => o.kind));
  const zoneIds = new Set(spec.zones.map((z) => z.roster));
  for (const z of ZONES)
    if (zoneIds.has(`roster.${z.id}`))
      z.slots.forEach((_, i) => {
        if (!placedKinds.has(slotKind(z.id, i)))
          errors.push(
            at(`roster ${z.id} slot ${i} (${slotKind(z.id, i)}) has no spawner on the map`),
          );
      });
  return errors;
}
