import { FIXTURES } from '../../content/world/fixtures';
import { NODES } from '../../content/items/recipes';
import { SPAWNERS } from '../../content/creatures';
import { NPCS } from '../../content/dialogue';
import { query } from '../kernel/entities';
import { px } from '../kernel/fixed';
import { spawnCampPot, spawnNode } from '../items';
import { spawnFixture } from '../systems/fixtures';
import { spawnNpc } from '../systems/npcs';
import { createSpawner } from '../systems/spawner';
import type { SimState } from '../state';

/** One placed object from the baked map, in tile coordinates of the whole world. */
export interface MapObject {
  kind: string;
  tx: number;
  ty: number;
}

const TILE = 16;

/**
 * Puts the map's objects into the sim: fixtures, gathering nodes, people, the camp pot and, when
 * asked, creature spawners.
 *
 * A saved game already holds the objects it was started with, but the map ships with the build, so
 * a newer build can add some (a new person, a new chest, a new node). With `onlyMissing` the state
 * is left as it is and only objects with no counterpart in it are added. A counterpart is the same
 * kind at the same place. People are matched by kind alone, because they are not tied to a tile
 * once the sim runs. Nothing is ever removed or moved, so what a player has done to the world
 * (a chest opened, a node spent, a creature killed) is kept.
 *
 * Returns how many objects were added. Pure: same state and objects in, same state out.
 */
export function populateMap(
  state: SimState,
  objects: readonly MapObject[],
  opts: {
    spawners: boolean;
    onlyMissing: boolean;
    /** Called with each fixture, node or spawner entity added, so chunk deltas can be applied to it. */
    onSpawn?: (id: number, o: MapObject) => void;
  },
): number {
  const have = opts.onlyMissing ? existing(state) : null;
  let added = 0;
  const wanted = (key: string, counted = false): boolean => {
    if (!have) return true;
    if (counted) {
      const n = have.counts.get(key) ?? 0;
      if (n > 0) {
        have.counts.set(key, n - 1);
        return false;
      }
      return true;
    }
    if (have.places.has(key)) return false;
    have.places.add(key);
    return true;
  };
  for (const o of objects) {
    const { kind, tx, ty } = o;
    if (kind.startsWith('fixture.') && FIXTURES[kind]) {
      if (!wanted(`fixture:${kind}@${px(tx * TILE + 8)},${px(ty * TILE + TILE)}`)) continue;
      const id = spawnFixture(state, kind, tx, ty);
      opts.onSpawn?.(id, o);
    } else if (kind.startsWith('node.') && NODES[kind]) {
      const x = tx * TILE + 8;
      const y = ty * TILE + 14;
      if (!wanted(`node:${kind}@${px(x)},${px(y)}`)) continue;
      const id = spawnNode(state, kind, x, y);
      opts.onSpawn?.(id, o);
    } else if (kind.startsWith('npc.') && NPCS[kind]) {
      if (!wanted(`npc:${kind}`, true)) continue;
      spawnNpc(state, kind, tx, ty);
    } else if (kind === 'prop.camp_pot') {
      const x = tx * TILE + 8;
      const y = ty * TILE + 14;
      if (!wanted(`camp_pot@${px(x)},${px(y)}`)) continue;
      spawnCampPot(state, x, y);
    } else continue;
    added++;
  }
  if (opts.spawners) {
    for (const o of objects) {
      if (!o.kind.startsWith('spawner.') || !SPAWNERS[o.kind]) continue;
      const x = o.tx * TILE + 8;
      const y = o.ty * TILE + 14;
      if (!wanted(`spawner:${o.kind}@${px(x)},${px(y)}`)) continue;
      const id = createSpawner(state, o.kind, x, y);
      opts.onSpawn?.(id, o);
      added++;
    }
  }
  return added;
}

/** What a loaded state already holds, as place keys and per-kind counts. */
function existing(state: SimState): { places: Set<string>; counts: Map<string, number> } {
  const places = new Set<string>();
  const counts = new Map<string, number>();
  const c = state.entities.comps;
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = c.fixture[id];
    if (f) places.add(`fixture:${f.kind}@${f.home.x},${f.home.y}`);
  }
  for (const id of query(state.entities, 'node', 'pos')) {
    const n = c.node[id];
    const p = c.pos[id];
    if (n && p) places.add(`node:${n.kind}@${p.x},${p.y}`);
  }
  for (const id of query(state.entities, 'npc')) {
    const n = c.npc[id];
    if (n) counts.set(`npc:${n.id}`, (counts.get(`npc:${n.id}`) ?? 0) + 1);
  }
  for (const id of query(state.entities, 'interactable', 'pos')) {
    const i = c.interactable[id];
    const p = c.pos[id];
    if (i?.kind === 'camp_pot' && p) places.add(`camp_pot@${p.x},${p.y}`);
  }
  for (const id of query(state.entities, 'spawner', 'pos')) {
    const s = c.spawner[id];
    const p = c.pos[id];
    if (s && p) places.add(`spawner:${s.kind}@${p.x},${p.y}`);
  }
  return { places, counts };
}
