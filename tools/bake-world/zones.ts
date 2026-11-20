import { SPAWNS } from '../../src/content/balance/world';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { zoneSpawnerKind } from '../../src/content/creatures/zoneSpawners';
import { ROSTERS } from '../../src/content/world/rosters';
import type { RegionSpec, TilePoint } from '../../src/content/world/regions/types';
import { BakeError } from '../../src/sim/world/bakeError';
import { Solid } from '../../src/sim/world/chunk';
import { collisionOfCell } from '../bake-assets/world';
import { Grid, Protect } from './grid';
import { h32 } from './rng';

const SALT = { jitterX: 0x5a01, jitterY: 0x5a02 } as const;

/** Even-odd test of a tile center against a polygon in tiles. */
function inPolygon(poly: readonly TilePoint[], x: number, y: number): boolean {
  const px = x + 0.5;
  const py = y + 0.5;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as TilePoint;
    const b = poly[j] as TilePoint;
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/**
 * Tiles from the nearest road, wall or town (any stamped tile) or wake point, by king moves. A
 * king's step is never longer than a straight line, so this never overstates the distance. A
 * single placement (a Waystone, a spawner) marks its tile as stamped but is not a wall, so it does
 * not count.
 */
export function clearance(spec: RegionSpec, g: Grid): Uint16Array {
  const far = 0xffff;
  const dist = new Uint16Array(g.w * g.h).fill(far);
  const queue: number[] = [];
  const single = new Set(
    spec.placements.filter((p) => !p.stamp && g.inside(p.x, p.y)).map((p) => g.at(p.x, p.y)),
  );
  for (let i = 0; i < dist.length; i++)
    if (g.has(i, Protect.Road | Protect.Stamp) && !single.has(i)) {
      dist[i] = 0;
      queue.push(i);
    }
  for (const p of spec.wakePoints)
    if (g.inside(p.x, p.y) && dist[g.at(p.x, p.y)] !== 0) {
      dist[g.at(p.x, p.y)] = 0;
      queue.push(g.at(p.x, p.y));
    }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q] as number;
    const x = i % g.w;
    const y = (i - x) / g.w;
    const d = (dist[i] as number) + 1;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!g.inside(nx, ny)) continue;
        const j = g.at(nx, ny);
        if ((dist[j] as number) > d) {
          dist[j] = d;
          queue.push(j);
        }
      }
  }
  return dist;
}

const REACH = Math.ceil(SPAWNS.radius / 16);
/** How far a zone spawner must stand from a road, wall or wake point: the rule plus its reach. */
export const ZONE_CLEAR = SPAWNS.clearTiles + REACH;
/** The same for a spawner of creatures that never start a fight. */
export const CALM_CLEAR = SPAWNS.calmClearTiles + REACH;

/** A tile a creature can stand on and walk away from: it and its eight neighbors are open land. */
function openGround(g: Grid, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!g.inside(nx, ny)) return false;
      const i = g.at(nx, ny);
      if (g.has(i, Protect.River | Protect.Bank | Protect.Cliff)) return false;
      const ground = g.ground[i] as number;
      if (ground === 0) return false;
      if (collisionOfCell({ ground, object: g.object[i] as number }) !== Solid.None) return false;
    }
  return true;
}

/**
 * Places each zone's spawners (POW-M4-05). A lattice `SPAWNS.spacingTiles` apart covers the
 * region; each lattice point inside a zone is nudged by a seeded amount and then moved to the
 * nearest open tile that keeps clear of roads, walls and wake points. A point with none nearby is
 * left empty. Each spawner takes the next creature of the zone's day list, and the next of its night
 * list, so every listed creature appears in a zone that has room for it.
 */
export function placeZoneSpawners(spec: RegionSpec, g: Grid): void {
  if (spec.zones.length === 0) return;
  const dist = clearance(spec, g);
  const step = SPAWNS.spacingTiles;
  const j = SPAWNS.jitterTiles;
  const used = new Map<string, number>();
  for (let ly = Math.floor(step / 2); ly < g.h; ly += step)
    for (let lx = Math.floor(step / 2); lx < g.w; lx += step) {
      const zone = spec.zones.find((z) => inPolygon(z.polygon, lx, ly));
      if (!zone) continue;
      const roster = ROSTERS[zone.roster];
      if (!roster)
        throw new BakeError(
          `region ${spec.id}`,
          `zones ${zone.id}`,
          `unknown roster ${zone.roster}`,
        );
      const s = roster.step;
      if (!s) continue;
      const cx = lx + (h32(spec.seed, lx, ly, SALT.jitterX) % (2 * j + 1)) - j;
      const cy = ly + (h32(spec.seed, lx, ly, SALT.jitterY) % (2 * j + 1)) - j;
      // The nearest open tile that clears the full rule; failing that, the nearest calm one.
      let at: TilePoint | null = null;
      let calm: TilePoint | null = null;
      for (let r = 0; r <= j && !at; r++)
        for (let dy = -r; dy <= r && !at; dy++)
          for (let dx = -r; dx <= r && !at; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (!g.inside(x, y) || !inPolygon(zone.polygon, x, y)) continue;
            const d = dist[g.at(x, y)] as number;
            if (d <= CALM_CLEAR || !openGround(g, x, y)) continue;
            if (d > ZONE_CLEAR) at = { x, y };
            else calm ??= { x, y };
          }
      const spot = at ?? calm;
      if (!spot) continue;
      // Near a road or wall only creatures that never pick a fight may spawn.
      const lists: ['day' | 'night', readonly string[]][] = [['day', roster.creatures]];
      if (roster.night) lists.push(['night', roster.night]);
      for (const [when, all] of lists) {
        const hours = roster.night ? when : undefined;
        const list = all.filter((c) => at !== null || !picksFights(c, hours));
        if (list.length === 0) continue;
        // Each roster takes its creatures in turn across all its zones, so none is crowded out.
        const key = `${roster.id}:${when}:${at ? 'any' : 'calm'}`;
        const n = used.get(key) ?? 0;
        used.set(key, n + 1);
        g.objects.push({
          ...spot,
          kind: zoneSpawnerKind(list[n % list.length] as string, s, hours),
        });
      }
    }
}

/**
 * True if a creature will start a fight on its own (hostile or territorial) in the hours its
 * spawner keeps it out: by day its day temperament, by night its night one, at all hours either.
 */
function picksFights(creature: string, when?: 'day' | 'night'): boolean {
  const c = CREATURES[creature];
  if (!c) return false;
  const bad = (t: string | undefined): boolean => t === 'hostile' || t === 'territorial';
  if (when === 'day') return bad(c.temperament);
  if (when === 'night') return bad(c.night ?? c.temperament);
  return bad(c.temperament) || bad(c.night);
}

/**
 * The spawn check (POW-M4-05): no hostile or territorial spawner on open land within
 * `SPAWNS.clearTiles` of a wake point, a road or a wall. Spawners inside a stamp (a dungeon room, a
 * training yard) are authored on purpose and are not held to it. A spawner that keeps its
 * creatures out only by day or only by night is judged by their temperament in those hours: they go
 * to ground outside them. Returns every problem found.
 */
export function checkSpawnClearance(spec: RegionSpec, g: Grid): string[] {
  const dist = clearance(spec, g);
  const errors: string[] = [];
  // A single placement marks its own tile as stamped too, but it is not inside a stamp.
  const single = new Set(
    spec.placements.filter((p) => !p.stamp).map((p) => `${p.kind}@${p.x},${p.y}`),
  );
  for (const o of g.objects) {
    const def = SPAWNERS[o.kind];
    if (!def || !picksFights(def.creature, def.when) || !g.inside(o.x, o.y)) continue;
    const i = g.at(o.x, o.y);
    const authored = g.has(i, Protect.Stamp) && !single.has(`${o.kind}@${o.x},${o.y}`);
    if (authored) continue;
    if ((dist[i] as number) <= SPAWNS.clearTiles)
      errors.push(
        `${spec.id}: ${o.kind} at ${o.x}, ${o.y} is within ${SPAWNS.clearTiles} tiles of a road, wall or wake point`,
      );
  }
  return errors;
}
