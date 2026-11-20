import { attune, stoneOfFixture } from './waystones';
import { wakePointAt } from './singulars';
import { STATUSES } from '../../content/combat/statuses';
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
  setComp(state.entities, id, 'fixture', {
    kind,
    open: def.litAtStart === true,
    home: { ...pos },
    ...(def.arena ? { arena: { state: 'idle' as const, wave: 0, foes: [] } } : {}),
  });
  if (def.type === 'board' && def.board)
    setComp(state.entities, id, 'board', { id: def.board, day: -1, posted: [] });
  if (def.unlockedBy) {
    // Hidden portal: a solid slab in the doorway until it is unlocked.
    const slab = px(def.size ?? TILE);
    setComp(state.entities, id, 'body', { w: slab, h: slab, solid: true });
    return id;
  }
  if (
    def.type === 'portal' ||
    def.type === 'arrival' ||
    def.type === 'plate' ||
    def.type === 'snare' ||
    def.type === 'torch' ||
    def.type === 'arena' ||
    def.type === 'ledge' ||
    def.type === 'rest'
  )
    return id;
  const size = px(def.size ?? TILE);
  // A hidden niche is a doorway in the wall: it does not block, and it cannot be used until revealed.
  // An arena door stands open until its arena starts.
  setComp(state.entities, id, 'body', {
    w: size,
    h: size,
    solid: def.hidden !== true && def.arenaDoor !== true,
  });
  if (def.arenaDoor) f0open(state, id);
  // Everything with a body can be used from the front. Element pieces answer to elements only.
  if (
    def.type !== 'gate' &&
    def.type !== 'element' &&
    def.type !== 'wall' &&
    def.type !== 'breakable'
  )
    setComp(state.entities, id, 'interactable', { kind });
  return id;
}

/** Marks a fixture open (a door that starts open). */
function f0open(state: SimState, id: EntityId): void {
  const f = getComp(state.entities, id, 'fixture');
  if (f) f.open = true;
}

function fixtureOfKind(state: SimState, kind: string): EntityId | null {
  for (const id of query(state.entities, 'fixture')) {
    if (getComp(state.entities, id, 'fixture')?.kind === kind) return id;
  }
  return null;
}

/**
 * Where a portal's destination fixture stands: the live fixture if its chunk is in, else the tile
 * its definition names, provided that tile's chunk has been streamed in (M4-21). Null while it has
 * not, so the avatar never lands in ground that is not there.
 */
function portalTarget(state: SimState, kind: string): { x: number; y: number } | null {
  const live = fixtureOfKind(state, kind);
  if (live !== null) return getComp(state.entities, live, 'pos') ?? null;
  const at = FIXTURES[kind]?.at;
  if (!at) return null;
  const stream = state.stream;
  if (stream && !stream.source.chunk(Math.floor(at.x / 32), Math.floor(at.y / 32))) return null;
  return { x: px(at.x * TILE + 8), y: px(at.y * TILE + TILE) };
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

function roomOfPos(state: SimState, x: number, y: number): string {
  return (
    roomAt(
      Math.floor(x / SUBPX / TILE),
      Math.floor((y / SUBPX - 1) / TILE),
      state.region ?? 'slice',
    )?.id ?? 'none'
  );
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
  if (f && def?.opensFrom && !f.open) return useShortcut(state, who, id);
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

/** A shortcut door opens, for good, only for an avatar standing on its open side. */
function useShortcut(state: SimState, who: EntityId, id: EntityId): void {
  const f = getComp(state.entities, id, 'fixture');
  const def = f ? FIXTURES[f.kind] : undefined;
  const me = getComp(state.entities, who, 'pos');
  const at = getComp(state.entities, id, 'pos');
  if (!f || !def?.opensFrom || !me || !at) return;
  // The door's centre is half a tile above its feet. Compare along the axis the side names.
  const dx = (me.x - at.x) / SUBPX;
  const dy = (me.y - (at.y - px(TILE / 2))) / SUBPX;
  const side = def.opensFrom;
  const onSide =
    (side === 'N' && dy < 0 && Math.abs(dy) >= Math.abs(dx)) ||
    (side === 'S' && dy > 0 && Math.abs(dy) >= Math.abs(dx)) ||
    (side === 'W' && dx < 0 && Math.abs(dx) > Math.abs(dy)) ||
    (side === 'E' && dx > 0 && Math.abs(dx) > Math.abs(dy));
  if (!onSide) {
    emit(state.events, { type: 'shortcutWrongSide', id, who });
    return;
  }
  f.open = true;
  const body = getComp(state.entities, id, 'body');
  if (body) body.solid = false;
  state.entities.comps.interactable[id] = null;
  emit(state.events, { type: 'doorOpened', id, who });
}

/** A switch turns on or off under the avatar's hand. A latching one stays on. */
function useSwitch(state: SimState, who: EntityId, id: EntityId): void {
  const f = getComp(state.entities, id, 'fixture');
  const def = f ? FIXTURES[f.kind] : undefined;
  if (!f || !def) return;
  if (def.latch && f.open) return;
  f.open = !f.open;
  emit(state.events, { type: 'switchChanged', id, on: f.open });
}

function useChest(state: SimState, who: EntityId, id: EntityId): void {
  const f = getComp(state.entities, id, 'fixture');
  const def = f ? FIXTURES[f.kind] : undefined;
  const a = getComp(state.entities, who, 'avatar');
  if (!f || !def?.loot || f.open) return;
  f.open = true;
  for (const l of def.loot.items) give(state, who, l.item, l.qty, 'chest');
  if (a && def.loot.coin) earnCoin(state, who, def.loot.coin, 'chest');
  const j = getComp(state.entities, who, 'journal');
  if (j && def.setsFlag && !j.flags.includes(def.setsFlag)) j.flags.push(def.setsFlag);
  emit(state.events, { type: 'chestOpened', id, who });
}

/** The bedroll opens the Rest panel: sleep, and wear or take off Paths. */
function useBed(state: SimState, who: EntityId, id: EntityId): void {
  emit(state.events, { type: 'bedOpened', id, who });
}

/** The bed within reach of `who`, if any: wearing Paths and sleeping need one close by. */
export function bedNear(state: SimState, who: EntityId): EntityId | null {
  const p = getComp(state.entities, who, 'pos');
  if (!p) return null;
  for (const id of query(state.entities, 'fixture', 'pos')) {
    if (FIXTURES[getComp(state.entities, id, 'fixture')?.kind ?? '']?.type !== 'bed') continue;
    const q = getComp(state.entities, id, 'pos');
    if (q && Math.hypot(q.x - p.x, q.y - p.y) / SUBPX <= W.bedReachPx) return id;
  }
  return null;
}

/** Sleeping on the bedroll: Rested for a night's length. */
export function sleep(state: SimState, who: EntityId): boolean {
  const id = bedNear(state, who);
  if (getComp(state.entities, who, 'fighter')?.state !== 'idle') return false;
  if (id === null) return sleepOutdoors(state, who);
  if (!applyStatus(state, who, 'rested', -1)) return false;
  emit(state.events, { type: 'slept', id, who });
  return true;
}

/**
 * Bedding down on open ground (M4-20). Not in a closed room, and not on a bedroll's account: it
 * gives no Rested of its own. The Wayfarer's Cloak makes it half a bedroll's rest. The place is
 * the wake point the avatar is at, if any, which is all a Singular reads.
 */
export function canSleepOutdoors(state: SimState, who: EntityId): boolean {
  const p = getComp(state.entities, who, 'pos');
  if (!p || getComp(state.entities, who, 'fighter')?.state !== 'idle') return false;
  if (bedNear(state, who) !== null) return false;
  const room = roomAt(
    Math.floor(p.x / SUBPX / TILE),
    Math.floor((p.y / SUBPX - 1) / TILE),
    state.region ?? 'slice',
  );
  return !room || !!room.outdoors;
}

function sleepOutdoors(state: SimState, who: EntityId): boolean {
  if (!canSleepOutdoors(state, who)) return false;
  const inv = getComp(state.entities, who, 'inventory');
  if (inv?.equipment.accessory?.item === 'item.wayfarers_cloak')
    applyStatus(state, who, 'rested', -1, { ticks: Math.floor(STATUSES.rested.ticks / 2) });
  emit(state.events, { type: 'sleptOutdoors', who, wake: wakePointAt(state, who) });
  return true;
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
  const stone = stoneOfFixture(state, id);
  if (stone) attune(state, who, state.region ?? 'slice', stone);
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
    case 'switch':
      return useSwitch(state, who, target);
    case 'tablet':
      emit(state.events, { type: 'tabletRead', id: target, who });
      return;
    case 'waystone':
      return useWaystone(state, who, target);
    case 'site':
      emit(state.events, { type: 'fixtureUsed', id: target, who, kind: f.kind });
      return;
    case 'storage':
      emit(state.events, { type: 'storageOpened', id: target, who });
      return;
    case 'board':
      emit(state.events, { type: 'boardOpened', id: target, who, board: def.board ?? '' });
      return;
    case 'bed':
      return useBed(state, who, target);
    case 'mirror':
      emit(state.events, { type: 'mirrorOpened', id: target, who });
      return;
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
  // Raised walls (Earth Wall) weigh a plate down too.
  const walls = query(state.entities, 'fixture', 'pos').filter(
    (id) => FIXTURES[getComp(state.entities, id, 'fixture')?.kind ?? '']?.type === 'wall',
  );
  const creatures = query(state.entities, 'ai', 'fighter', 'pos').filter(
    (id) => getComp(state.entities, id, 'fighter')?.state !== 'dead',
  );
  const pressedKinds = new Set<string>();
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    const p = getComp(state.entities, id, 'pos');
    if (!f || !def || !p) continue;
    // A switch that is on counts as a pressed plate of its own kind.
    if (def.type === 'switch' && f.open) pressedKinds.add(f.kind);
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
      // Plates take weight. What counts is the plate's `holds`: a block alone unless it says more.
      const holds = def.holds ?? ['block'];
      const byBlock = holds.includes('block') ? blocks.find((b) => near(b, 7)) : undefined;
      const pressed =
        byBlock !== undefined ||
        (holds.includes('avatar') && avatars.some((a) => near(a, 4))) ||
        (holds.includes('creature') && creatures.some((e) => near(e, 4))) ||
        (holds.includes('wall') && walls.some((w) => near(w, 7)));
      if (pressed !== f.open) {
        f.open = pressed;
        emit(state.events, { type: 'plateChanged', id, pressed });
        if (pressed && byBlock !== undefined)
          emit(state.events, { type: 'blockSolved', id, block: byBlock });
      }
      if (pressed) pressedKinds.add(f.kind);
    }
  }
  // A gate opens when its plate or switch is on and stays open. A timed gate keeps pushing its
  // `until` forward while it is held, and the element system shuts it (waiting while anyone stands
  // in it) once `holdTicks` pass with nothing holding it.
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    if (!f || def?.type !== 'gate' || !def.plate || def.arenaDoor) continue;
    if (!pressedKinds.has(def.plate)) continue;
    if (def.holdTicks !== undefined) f.until = state.worldTick + def.holdTicks;
    if (f.open) continue;
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
      const dest = FIXTURES[def.to];
      const dp = portalTarget(state, def.to);
      if (!dest || !dp) continue;
      const off = dest.arrive ?? [0, 0];
      const from = roomOfPos(state, q.x, q.y);
      q.x = dp.x + px(off[0]);
      q.y = dp.y - px(TILE / 2) + px(off[1]);
      const v = getComp(state.entities, a, 'vel');
      if (v) {
        v.x = 0;
        v.y = 0;
      }
      if (def.fall) fall(state, a, def.fall);
      const to = roomOfPos(state, q.x, q.y);
      if (to !== from) {
        resetRoom(state, to);
        emit(state.events, { type: 'roomChanged', who: a, from, to });
      }
    }
  }
}

/** A drop costs a share of maximum Health, never the last point. */
function fall(state: SimState, who: EntityId, pct: number): void {
  const pools = getComp(state.entities, who, 'pools');
  if (!pools) return;
  const amount = Math.min(pools.hp - 1, Math.ceil((pools.hpMax * pct) / 100));
  if (amount <= 0) return;
  pools.hp -= amount;
  emit(state.events, { type: 'fell', who, amount });
}

/** Removes every fixture. For reloading a map. */
export function clearFixtures(state: SimState): void {
  for (const id of query(state.entities, 'fixture')) destroy(state.entities, id);
}
