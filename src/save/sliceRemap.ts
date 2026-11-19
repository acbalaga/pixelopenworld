import { destroy } from '../sim/kernel/entities';
import { px } from '../sim/kernel/fixed';
import type { SimState } from '../sim/state';

/**
 * The move from the slice map to Dawnmeadow (POW-M4-04, schema 22 to 23).
 *
 * The slice was a 96 x 96 tile outdoor area (chunks 0..2) with a cave below it. Dawnmeadow is
 * 384 x 384 tiles and the game boots into it, so a position in the slice means nothing there.
 * Where the avatar goes:
 *
 * - Outdoors on the slice (tile row under 96): Hearthford's square. The old square's offset from
 *   the old spawn (47, 39) is kept, clamped to the rows and columns of the new square that are
 *   known to be open ground, so someone standing at the old Waystone stands at the new one.
 * - Inside the old cave (tile row 96 and below): outside the Rootway's entrance, on Hollow Downs
 *   by the great oak. The cave itself arrives in POW-M4-21.
 *
 * What goes: every object the slice map placed (fixtures, nodes, spawners, people, the camp pot)
 * and every creature and projectile, because their positions are slice tiles and the region
 * places its own. Streaming adds the region's objects as their chunks load. The chunk deltas
 * described slice objects, so they go with them. What stays: the avatar and everything the player
 * owns (the bag, storage, skills, journal and ledger live on the avatar), drops lying in the
 * world, a death echo holding coin, and placed snares. Those are moved to the avatar's new place.
 */
export const SLICE_SPAWN = { x: 47, y: 39 } as const;
/** First tile row of the old cave. */
export const SLICE_CAVE_ROW = 96;
/** Hearthford's Waystone is at (185, 189). The old spawn was two tiles south of the old one. */
export const SQUARE_ANCHOR = { x: 185, y: 191 } as const;
/** Offsets from the anchor that are open ground in the baked square (a test reads the bake). */
export const SQUARE_SPREAD = { x: [-4, 12], y: [0, 2] } as const;
/** Open ground south of the great oak on Hollow Downs, in front of the Rootway's entrance. */
export const ROOTWAY_DOORSTEP = { x: 122, y: 253 } as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The Dawnmeadow tile for a slice tile. */
export function dawnmeadowTile(tx: number, ty: number): { x: number; y: number } {
  if (ty >= SLICE_CAVE_ROW) return { ...ROOTWAY_DOORSTEP };
  return {
    x: SQUARE_ANCHOR.x + clamp(tx - SLICE_SPAWN.x, SQUARE_SPREAD.x[0], SQUARE_SPREAD.x[1]),
    y: SQUARE_ANCHOR.y + clamp(ty - SLICE_SPAWN.y, SQUARE_SPREAD.y[0], SQUARE_SPREAD.y[1]),
  };
}

/** Feet position, sub-pixel units, for a slice position (feet are 8 across and 14 down in a tile). */
function remapVec(v: { x: number; y: number }): { x: number; y: number } {
  const t = dawnmeadowTile(Math.floor(v.x / 256 / 16), Math.floor((v.y / 256 - 1) / 16));
  return { x: px(t.x * 16 + 8), y: px(t.y * 16 + 14) };
}

/** Remaps a slice state in place. */
export function remapFromSlice(s: SimState): void {
  const e = s.entities;
  const c = e.comps;
  const keep = (id: number): boolean =>
    c.avatar[id] !== null ||
    c.pickup[id] !== null ||
    c.echo[id] !== null ||
    c.fixture[id]?.kind === 'fixture.snare';
  for (let id = 0; id < e.capacity; id++) {
    if (!e.alive[id]) continue;
    const pos = c.pos[id];
    if (!keep(id)) {
      destroy(e, id);
      continue;
    }
    if (pos) {
      const to = remapVec(pos);
      pos.x = to.x;
      pos.y = to.y;
    }
    const f = c.fixture[id];
    if (f && pos) f.home = { x: pos.x, y: pos.y };
    const a = c.avatar[id];
    if (a) a.respawn = remapVec(a.respawn);
  }
  // What an avatar was doing with a destroyed entity is over: a gather on a node, a lock on a foe.
  for (let id = 0; id < e.capacity; id++) {
    if (c.avatar[id] === null || !e.alive[id]) continue;
    c.gather[id] = null;
    const fighter = c.fighter[id];
    if (fighter) fighter.lock = null;
    const d = c.deeds[id];
    if (d) d.near = [];
  }
  s.deltas = {};
}
