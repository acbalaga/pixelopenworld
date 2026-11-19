import { SPAWNERS } from '../../content/creatures';
import { spawnCreature } from '../combat/enemy';
import { destroy, getComp, query, setComp, spawn, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { px, SUBPX } from '../kernel/fixed';
import { int } from '../kernel/rng';
import type { SimState } from '../state';
import { frozenAt } from '../world/stream';
import { dayIndex } from '../time';

/** Places a spawner at a position in whole px. It fills to its cap on the first tick. */
export function createSpawner(state: SimState, kind: string, xPx: number, yPx: number): EntityId {
  const def = SPAWNERS[kind];
  if (!def) throw new Error(`unknown spawner ${kind}`);
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x: px(xPx), y: px(yPx) });
  setComp(state.entities, id, 'spawner', { kind, timer: def.respawn, members: [] });
  return id;
}

/**
 * Keeps each spawner at its population cap. Gone members are dropped from the list. Below the
 * cap, a new creature appears after the respawn time, at a free spot near the spawner.
 */
export function spawnerSystem(state: SimState): void {
  for (const id of query(state.entities, 'spawner', 'pos')) {
    const sp = getComp(state.entities, id, 'spawner');
    const p = getComp(state.entities, id, 'pos');
    const def = sp ? SPAWNERS[sp.kind] : undefined;
    if (!sp || !p || !def || frozenAt(state, p.x, p.y)) continue;
    const had = sp.members.length;
    sp.members = sp.members.filter((m) => state.entities.alive[m] === true);
    if (def.daily) {
      // A fallen creature counts as gone at once, so the day it died on is the day it is marked.
      sp.members = sp.members.filter((m) => state.entities.comps.fighter[m]?.state !== 'dead');
      // A daily spawner's crew is gone for the rest of the day it fell on.
      const today = dayIndex(state.worldTick);
      if (had > 0 && sp.members.length === 0 && sp.clearedDay === undefined) sp.clearedDay = today;
      if (sp.clearedDay !== undefined && today <= sp.clearedDay) continue;
    }
    if (sp.members.length >= def.cap) {
      sp.timer = 0;
      continue;
    }
    sp.timer++;
    if (sp.timer < def.respawn) continue;
    for (let tries = 0; tries < 8; tries++) {
      const x =
        Math.round(p.x / SUBPX) +
        (def.radius > 0 ? int(state.rng.world, -def.radius, def.radius + 1) : 0);
      const y =
        Math.round(p.y / SUBPX) +
        (def.radius > 0 ? int(state.rng.world, -def.radius, def.radius + 1) : 0);
      if (state.world && state.world.solidAt(Math.floor(x / 16), Math.floor((y - 4) / 16)) !== 0)
        continue;
      const c = spawnCreature(state, def.creature, x, y, id);
      sp.members.push(c);
      sp.timer = 0;
      delete sp.clearedDay;
      emit(state.events, { type: 'spawned', id: c, creature: def.creature });
      break;
    }
  }
}

/** Removes a spawner and its creatures. */
export function removeSpawner(state: SimState, id: EntityId): void {
  const sp = getComp(state.entities, id, 'spawner');
  for (const m of sp?.members ?? []) destroy(state.entities, m);
  destroy(state.entities, id);
}
