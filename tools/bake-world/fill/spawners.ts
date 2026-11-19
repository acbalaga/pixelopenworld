import type { RegionSpec } from '../../../src/content/world/regions/types';
import { ZONES, slotKind } from '../../../src/content/creatures/rosters';
import { SPAWNERS } from '../../../src/content/creatures';
import { TILESET, Terrain } from '../../../src/content/world/tileset';
import { Grid, Protect } from '../grid';
import { roll } from '../rng';
import { SAFE_TILES, startsFights } from '../spawnRules';

const SALT = 91;
/** Spawners keep at least this far apart, in tiles. */
const SPACING = 9;
/** Every spawner stays this far from a settlement, in tiles. */
const OFF_STAMP = 4;
const TRIES = 80;

/** Tile ids of the town wall, which the fight rule measures from. */
const WALL_IDS = new Set(
  ['h', 'v', 'post'].map((k) => TILESET.indexOf(`tile.wall_stone_${k}`) + 1).filter((i) => i > 0),
);

/** True if any tile within `r` of (x, y) has one of the protect bits. */
function near(g: Grid, x: number, y: number, r: number, bits: number): boolean {
  for (let j = Math.max(0, y - r); j <= Math.min(g.h - 1, y + r); j++)
    for (let i = Math.max(0, x - r); i <= Math.min(g.w - 1, x + r); i++)
      if ((i - x) ** 2 + (j - y) ** 2 <= r * r && g.has(g.at(i, j), bits)) return true;
  return false;
}

function nearWall(g: Grid, x: number, y: number, r: number): boolean {
  for (let j = Math.max(0, y - r); j <= Math.min(g.h - 1, y + r); j++)
    for (let i = Math.max(0, x - r); i <= Math.min(g.w - 1, x + r); i++)
      if ((i - x) ** 2 + (j - y) ** 2 <= r * r && WALL_IDS.has(g.object[g.at(i, j)] as number))
        return true;
  return false;
}

/**
 * Places each zone roster's spawners across the zone's chunks (POW-M4-05). A spawner stands on
 * open ground nothing else claimed, off settlements and roads, apart from the others. One that
 * starts fights (hostile or territorial, by day or night) also keeps `SAFE_TILES` from every wake
 * point, road and town wall. Deterministic: rolls depend only on the seed and the position.
 */
export function fillSpawners(spec: RegionSpec, g: Grid): void {
  const placed: { x: number; y: number }[] = g.objects
    .filter((o) => o.kind.startsWith('spawner.'))
    .map((o) => ({ x: o.x, y: o.y }));
  for (const zone of spec.zones) {
    const roster = ZONES.find((z) => `roster.${z.id}` === zone.roster);
    if (!roster) continue;
    const xs = zone.polygon.map((p) => p.x);
    const ys = zone.polygon.map((p) => p.y);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    roster.slots.forEach((slot, si) => {
      const kind = slotKind(roster.id, si);
      const def = SPAWNERS[kind];
      if (!def) return;
      const danger = startsFights(def);
      let made = 0;
      for (let t = 0; t < TRIES && made < slot.perChunk; t++) {
        const x = x0 + Math.floor(roll(spec.seed, x0 + t, y0, SALT + si * 2) * (x1 - x0 + 1));
        const y = y0 + Math.floor(roll(spec.seed, x0, y0 + t, SALT + si * 2 + 1) * (y1 - y0 + 1));
        const i = g.at(x, y);
        const ground = g.ground[i];
        if (ground !== Terrain.Grass && ground !== Terrain.Dirt) continue;
        if (g.object[i] !== 0 || g.protect[i] !== 0) continue;
        if (
          near(
            g,
            x,
            y,
            OFF_STAMP,
            Protect.Stamp | Protect.Road | Protect.River | Protect.Bank | Protect.Cliff,
          )
        )
          continue;
        if (placed.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < SPACING * SPACING)) continue;
        if (danger) {
          if (near(g, x, y, SAFE_TILES, Protect.Road) || nearWall(g, x, y, SAFE_TILES)) continue;
          if (
            spec.wakePoints.some((w) => (w.x - x) ** 2 + (w.y - y) ** 2 < SAFE_TILES * SAFE_TILES)
          )
            continue;
        }
        g.objects.push({ x, y, kind });
        placed.push({ x, y });
        made++;
      }
    });
  }
}
