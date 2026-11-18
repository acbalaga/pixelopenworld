import { offerFromFixture } from './trials';
import { WORLD_TUNABLES as W } from '../../content/balance/world';
import { FIXTURES } from '../../content/world/fixtures';
import { roomAt } from '../../content/world/rooms';
import { destroy, getComp, query, setComp, spawn, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { dirStep, px, SUBPX } from '../kernel/fixed';
import { give, removeItem } from '../items';
import { applyStatus } from '../statuses';
import type { SimState } from '../state';
import { overlapsSolid, type Box } from './collision';
import { contextTarget } from './interact';
import { earnCoin } from '../ledger';

const TILE = 16;

/** Places a fixture on a tile. Feet sit at the bottom center, so it sorts like a prop. */
export function spawnFixture(state: SimState, kind: string, tx: number, ty: number): EntityId {
  const def = FIXTURES[kind];
  if (!def) throw new Error(`unknown fixture ${kind}`);
  const id = spawn(state.entities);
  const pos = { x: px(tx * TILE + 8), y: px(ty * TILE + TILE) };
  setComp(state.entities, id, 'pos', pos);
  setComp(state.entities, id, 'fixture', { kind, open: false, home: { ...pos } });
  if (def.unlockedBy) {
    // Hidden portal: a solid slab in the doorway until it is unlocked.
    const slab = px(def.size ?? TILE);
    setComp(state.entities, id, 'body', { w: slab, h: slab, solid: true });
    return id;
  }
  if (def.type === 'portal' || def.type === 'arrival' || def.type === 'plate') return id;
  const size = px(def.size ?? TILE);
  // A hidden niche is a doorway in the wall: it does not block, and it cannot be used until revealed.
  setComp(state.entities, id, 'body', { w: size, h: size, solid: def.hidden !== true });
  // Everything with a body can be used from the front. Element pieces answer to elements only.
  if (def.type !== 'gate' && def.type !== 'element' && def.type !== 'wall')
    setComp(state.entities, id, 'interactable', { kind });
  return id;
}

function fixtureOfKind(state: SimState, kind: string): EntityId | null {
  for (const id of query(state.entities, 'fixture')) {
    if (getComp(state.entities, id, 'fixture')?.kind === kind) return id;
  }
  return null;
}

/** Fixtures that currently block, as boxes in sub-pixel units. */
function solidBodies(state: SimState, except: EntityId): Box[] {
  const out: Box[] = [];
  for (const id of query(state.entities, 'body', 'pos')) {
    if (id === except) continue;
    const b = getComp(state.entities, id, 'body');
    const p = getComp(state.entities, id, 'pos');
    if (!b || !p || !b.solid) continue;
    out.push({ x: p.x - b.w / 2, y: p.y - b.h, w: b.w, h: b.h });
  }
  return out;
}

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function roomOfPos(x: number, y: number): string {
  return roomAt(Math.floor(x / SUBPX / TILE), Math.floor((y / SUBPX - 1) / TILE))?.id ?? 'none';
}

/** Puts a block back where it started. */
function resetBlock(state: SimState, id: EntityId): void {
  const f = getComp(state.entities, id, 'fixture');
  const p = getComp(state.entities, id, 'pos');
  if (!f || !p || (p.x === f.home.x && p.y === f.home.y)) return;
  p.x = f.home.x;
  p.y = f.home.y;
  emit(state.events, { type: 'blockReset', id });
}

/** On entering a room, blocks that belong to an unsolved puzzle there go back to their start. */
function resetRoom(state: SimState, room: string): void {
  for (const id of query(state.entities, 'fixture')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    if (!f || def?.type !== 'block' || def.room !== room) continue;
    const gate = def.gate ? fixtureOfKind(state, def.gate) : null;
    const solved = gate !== null && getComp(state.entities, gate, 'fixture')?.open === true;
    if (!solved) resetBlock(state, id);
  }
}

function useDoor(state: SimState, who: EntityId, id: EntityId): void {
  const f = getComp(state.entities, id, 'fixture');
  const def = f ? FIXTURES[f.kind] : undefined;
  const inv = getComp(state.entities, who, 'inventory');
  if (!f || !def?.key || !inv || f.open) return;
  if (!removeItem(inv, def.key, 1)) {
    emit(state.events, { type: 'doorLocked', id, who, key: def.key });
    return;
  }
  f.open = true;
  const body = getComp(state.entities, id, 'body');
  if (body) body.solid = false;
  state.entities.comps.interactable[id] = null;
  emit(state.events, { type: 'doorOpened', id, who });
}

function useChest(state: SimState, who: EntityId, id: EntityId): void {
  const f = getComp(state.entities, id, 'fixture');
  const def = f ? FIXTURES[f.kind] : undefined;
  const a = getComp(state.entities, who, 'avatar');
  if (!f || !def?.loot || f.open) return;
  f.open = true;
  for (const l of def.loot.items) give(state, who, l.item, l.qty, 'chest');
  if (a && def.loot.coin) earnCoin(state, who, def.loot.coin, 'chest');
  emit(state.events, { type: 'chestOpened', id, who });
}

/** Sleeping on the bedroll: Rested for a night's length. */
function useBed(state: SimState, who: EntityId, id: EntityId): void {
  if (!applyStatus(state, who, 'rested', -1))
    // Already rested: the timer is refreshed, so this only fails for a unit that cannot be rested.
    return;
  emit(state.events, { type: 'slept', id, who });
}

function useWaystone(state: SimState, who: EntityId, id: EntityId): void {
  const a = getComp(state.entities, who, 'avatar');
  const p = getComp(state.entities, id, 'pos');
  const pools = getComp(state.entities, who, 'pools');
  if (!a || !p) return;
  // Wake just south of the stone.
  a.respawn = { x: p.x, y: p.y + px(12) };
  if (pools && W.waystoneHeals) {
    pools.hp = pools.hpMax;
    pools.sta = pools.staMax;
    pools.foc = pools.focMax;
  }
  emit(state.events, { type: 'waystoneSet', id, who });
}

/** Pushes a block one tile along the avatar's facing, if the way is clear and not an exit. */
function pushBlock(state: SimState, who: EntityId, id: EntityId): void {
  const a = getComp(state.entities, who, 'avatar');
  const p = getComp(state.entities, id, 'pos');
  const body = getComp(state.entities, id, 'body');
  if (!a || !p || !body) return;
  const f = dirStep(a.facing);
  const nx = p.x + f.x * px(W.blockStep);
  const ny = p.y + f.y * px(W.blockStep);
  const box: Box = { x: nx - body.w / 2, y: ny - body.h, w: body.w, h: body.h };
  if (state.world && overlapsSolid(state.world, box)) return;
  for (const other of solidBodies(state, id)) if (overlap(box, other)) return;
  const clear = px(W.blockPortalClear);
  for (const pid of query(state.entities, 'fixture', 'pos')) {
    const pf = getComp(state.entities, pid, 'fixture');
    const type = pf ? FIXTURES[pf.kind]?.type : undefined;
    if (type !== 'portal' && type !== 'arrival') continue;
    const pp = getComp(state.entities, pid, 'pos');
    if (!pp) continue;
    if (Math.abs(pp.x - nx) < clear && Math.abs(pp.y - body.h / 2 - (ny - body.h / 2)) < clear)
      return;
  }
  p.x = nx;
  p.y = ny;
  emit(state.events, { type: 'blockPushed', id });
}

/** The context button on a fixture in front of the avatar. Does nothing for anything else. */
export function interactFixture(state: SimState, who: EntityId): void {
  if (getComp(state.entities, who, 'fighter')?.state !== 'idle') return;
  if (getComp(state.entities, who, 'gather')) return;
  const target = contextTarget(state, who);
  if (target === null) return;
  const f = getComp(state.entities, target, 'fixture');
  const def = f ? FIXTURES[f.kind] : undefined;
  if (!f || !def) return;
  offerFromFixture(state, who, f.kind);
  switch (def.type) {
    case 'door':
      return useDoor(state, who, target);
    case 'chest':
      return useChest(state, who, target);
    case 'block':
      return pushBlock(state, who, target);
    case 'tablet':
      emit(state.events, { type: 'tabletRead', id: target, who });
      return;
    case 'waystone':
      return useWaystone(state, who, target);
    case 'storage':
      emit(state.events, { type: 'storageOpened', id: target, who });
      return;
    case 'bed':
      return useBed(state, who, target);
    case 'element':
      // Only a revealed niche can be opened. The rest answer to elements, not to the button.
      if (f.revealed) useChest(state, who, target);
      return;
    default:
  }
}

/** Plates, gates and portals, once per tick. */
export function fixturesSystem(state: SimState): void {
  const avatars = query(state.entities, 'avatar', 'pos').filter(
    (a) => getComp(state.entities, a, 'fighter')?.state !== 'dead',
  );
  const blocks = query(state.entities, 'fixture', 'pos').filter(
    (id) => FIXTURES[getComp(state.entities, id, 'fixture')?.kind ?? '']?.type === 'block',
  );
  const pressedKinds = new Set<string>();
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    const p = getComp(state.entities, id, 'pos');
    if (!f || !def || !p) continue;
    if (def.type === 'plate') {
      const c = { x: p.x / SUBPX, y: p.y / SUBPX - TILE / 2 };
      const near = (e: EntityId, lift: number): boolean => {
        const q = getComp(state.entities, e, 'pos');
        return (
          q !== undefined &&
          Math.abs(q.x / SUBPX - c.x) <= W.plateRadius &&
          Math.abs(q.y / SUBPX - lift - c.y) <= W.plateRadius
        );
      };
      // Plates take weight: only a block presses one, so walking over it does nothing.
      const pressed = blocks.some((b) => near(b, 7));
      if (pressed !== f.open) {
        f.open = pressed;
        emit(state.events, { type: 'plateChanged', id, pressed });
      }
      if (pressed) pressedKinds.add(f.kind);
    }
  }
  // A gate opens when its plate is pressed and stays open.
  for (const id of query(state.entities, 'fixture')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    if (!f || def?.type !== 'gate' || f.open || !def.plate || !pressedKinds.has(def.plate))
      continue;
    f.open = true;
    const body = getComp(state.entities, id, 'body');
    if (body) body.solid = false;
    emit(state.events, { type: 'gateOpened', id });
  }
  // A hidden way opens for good when the creature that guards it falls.
  for (const ev of state.events.list) {
    if (ev.type !== 'died' || ev.team !== 1) continue;
    const kind = getComp(state.entities, ev.id, 'combatant')?.kind;
    if (!kind) continue;
    for (const id of query(state.entities, 'fixture')) {
      const f = getComp(state.entities, id, 'fixture');
      if (!f || f.open || FIXTURES[f.kind]?.unlockedBy !== kind) continue;
      f.open = true;
      const body = getComp(state.entities, id, 'body');
      if (body) body.solid = false;
      emit(state.events, { type: 'shortcutOpened', id });
    }
  }
  // Portals.
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    const p = getComp(state.entities, id, 'pos');
    if (!f || def?.type !== 'portal' || !def.to || !p) continue;
    if (def.unlockedBy && !f.open) continue;
    for (const a of avatars) {
      const q = getComp(state.entities, a, 'pos');
      if (!q) continue;
      if (
        Math.abs(q.x - p.x) / SUBPX > W.portalRadius ||
        Math.abs(q.y - (p.y - px(TILE / 2))) / SUBPX > W.portalRadius
      )
        continue;
      const destId = fixtureOfKind(state, def.to);
      const dest = destId === null ? undefined : FIXTURES[def.to];
      const dp = destId === null ? undefined : getComp(state.entities, destId, 'pos');
      if (!dest || !dp) continue;
      const off = dest.arrive ?? [0, 0];
      const from = roomOfPos(q.x, q.y);
      q.x = dp.x + px(off[0]);
      q.y = dp.y - px(TILE / 2) + px(off[1]);
      const v = getComp(state.entities, a, 'vel');
      if (v) {
        v.x = 0;
        v.y = 0;
      }
      const to = roomOfPos(q.x, q.y);
      if (to !== from) {
        resetRoom(state, to);
        emit(state.events, { type: 'roomChanged', who: a, from, to });
      }
    }
  }
}

/** Removes every fixture. For reloading a map. */
export function clearFixtures(state: SimState): void {
  for (const id of query(state.entities, 'fixture')) destroy(state.entities, id);
}
