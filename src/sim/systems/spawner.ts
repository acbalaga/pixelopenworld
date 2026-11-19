import { PHASE_DESPAWN_PX } from '../../content/balance/world';
import { SPAWNERS } from '../../content/creatures';
import type { SpawnerDef } from '../../content/creatures/types';
import { spawnCreature } from '../combat/enemy';
import { destroy, getComp, query, setComp, spawn, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { px, SUBPX } from '../kernel/fixed';
import { int } from '../kernel/rng';
import type { SimState } from '../state';
import { frozenAt } from '../world/stream';
import { dayIndex } from '../time';
import { isDark } from '../combat/temperament';
import { centerPx } from '../combat/fighter';
import { len } from '../combat/geometry';
import { spawnTicks } from '../weatherEffects';

/** Who this spawner puts out right now: its day creature, its night creature, or null for nobody. */
export function creatureNow(def: SpawnerDef, worldTick: number): string | null {
  if (!def.phases) return def.creature;
  return isDark(worldTick) ? def.phases.night : def.phases.day;
}

/** Where a roaming spawner's creature calls home today, in tiles, or null if it does not roam. */
export function routePoint(def: SpawnerDef, worldTick: number): { x: number; y: number } | null {
  if (!def.route || def.route.length === 0) return null;
  return def.route[dayIndex(worldTick) % def.route.length] as { x: number; y: number };
}

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
    // Creatures of the other phase leave once no avatar is near to watch them go.
    const now = creatureNow(def, state.worldTick);
    if (def.phases) {
      for (const m of sp.members) {
        const ai = state.entities.comps.ai[m];
        if (!ai || ai.creature === now || ai.state !== 'idle') continue;
        if (!avatarNear(state, m, PHASE_DESPAWN_PX)) destroy(state.entities, m);
      }
      sp.members = sp.members.filter((m) => state.entities.alive[m] === true);
    }
    // A roaming creature calls today's point home. It walks there on its own (the leash).
    const home = routePoint(def, state.worldTick);
    if (home) {
      for (const m of sp.members) {
        const ai = state.entities.comps.ai[m];
        const hx = px(home.x * 16 + 8);
        const hy = px(home.y * 16 + 14);
        if (ai && (ai.home.x !== hx || ai.home.y !== hy)) ai.home = { x: hx, y: hy };
      }
    }
    if (now === null || sp.members.length >= def.cap) {
      sp.timer = 0;
      continue;
    }
    sp.timer += spawnTicks(state, p.x, p.y);
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
      const c = spawnCreature(state, now, x, y, id, true, def.step ?? 'a');
      sp.members.push(c);
      sp.timer = 0;
      delete sp.clearedDay;
      emit(state.events, { type: 'spawned', id: c, creature: def.creature });
      break;
    }
  }
}

/** True if any avatar is within `range` px of the entity. */
function avatarNear(state: SimState, id: EntityId, range: number): boolean {
  const me = centerPx(state, id);
  if (!me) return false;
  for (const a of query(state.entities, 'avatar', 'pos')) {
    const c = centerPx(state, a);
    if (c && len({ x: c.x - me.x, y: c.y - me.y }) < range) return true;
  }
  return false;
}

/** Removes a spawner and its creatures. */
export function removeSpawner(state: SimState, id: EntityId): void {
  const sp = getComp(state.entities, id, 'spawner');
  for (const m of sp?.members ?? []) destroy(state.entities, m);
  destroy(state.entities, id);
}
