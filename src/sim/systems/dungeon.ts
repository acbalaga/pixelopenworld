/**
 * Dungeon rules (M4-08) that sit on top of fixtures: breakable walls, torches and dark rooms,
 * arenas, and the Delving events. Locks and keys, plates, switches, gates, blocks, drops and
 * shortcut doors live in `fixtures.ts` beside the older pieces they extend. Persistence needs
 * nothing extra: a fixture's state is saved as a chunk delta, so solved stays solved.
 */
import { WORLD_TUNABLES as W } from '../../content/balance/world';
import { STATUS_BALANCE as SB } from '../../content/balance/status';
import { DUNGEONS, dungeonOfRoom } from '../../content/world/dungeons';
import { FIXTURES, type HitKind, type RoomDef } from '../../content/world/fixtures';
import { roomsOf } from '../../content/world/rooms';
import { spawnCreature } from '../combat/enemy';
import { len } from '../combat/geometry';
import { destroy, getComp, isAlive, query, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { SUBPX, type Vec } from '../kernel/fixed';
import { int } from '../kernel/rng';
import { drain } from '../statuses';
import type { SimState } from '../state';
import { currentWeather, dayPhase, minuteOfDay, tideLow } from '../time';
import { pointsOf } from '../skills';

const TILE = 16;

/**
 * A hit of `kind` landed at `at` (px). Every breakable wall that breaks to it within reach breaks
 * for good. Returns how many broke. Called for Stone and Ember hits by the element code, and for a
 * heavy weapon's swing by combat.
 */
export function hitFixtures(state: SimState, kind: HitKind, at: Vec): number {
  let n = 0;
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    const p = getComp(state.entities, id, 'pos');
    if (!f || !p || def?.type !== 'breakable' || f.open || !def.breaksBy?.includes(kind)) continue;
    const c = { x: p.x / SUBPX, y: p.y / SUBPX - TILE / 2 };
    if (len({ x: c.x - at.x, y: c.y - at.y }) > SB.worldHitRadius + (def.size ?? TILE) / 2)
      continue;
    f.open = true;
    const body = getComp(state.entities, id, 'body');
    if (body) body.solid = false;
    emit(state.events, { type: 'wallBroken', id, kind });
    n++;
  }
  return n;
}

/** The room containing a point (px), or null. */
function roomAtPx(rooms: readonly RoomDef[], x: number, y: number): RoomDef | null {
  const tx = Math.floor(x / SUBPX / TILE);
  const ty = Math.floor((y / SUBPX - 1) / TILE);
  for (const r of rooms) if (tx >= r.x0 && tx < r.x1 && ty >= r.y0 && ty < r.y1) return r;
  return null;
}

/**
 * Whether `who` can see in the room they stand in. A room that is not dark is always lit. A dark
 * one is lit while a torch burns in it or the avatar holds a lantern in the off hand. In the
 * dark the renderer shows nothing but telegraph markers.
 */
export function litFor(
  state: SimState,
  who: EntityId,
  rooms: readonly RoomDef[] = roomsOf(state.region ?? 'slice'),
): boolean {
  const p = getComp(state.entities, who, 'pos');
  const room = p ? roomAtPx(rooms, p.x, p.y) : null;
  if (!room?.dark) return true;
  if (getComp(state.entities, who, 'inventory')?.equipment.off?.item === 'item.lantern')
    return true;
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const q = getComp(state.entities, id, 'pos');
    if (!f?.open || !q || FIXTURES[f.kind]?.type !== 'torch') continue;
    if (roomAtPx(rooms, q.x, q.y)?.id === room.id) return true;
  }
  return false;
}

/** Fixtures of the given kinds within `reach` px of a point, as ids. */
function fixturesNear(
  state: SimState,
  kinds: readonly string[],
  at: Vec,
  reach: number,
): EntityId[] {
  return query(state.entities, 'fixture', 'pos').filter((id) => {
    const f = getComp(state.entities, id, 'fixture');
    const p = getComp(state.entities, id, 'pos');
    return (
      f !== undefined &&
      p !== undefined &&
      kinds.includes(f.kind) &&
      len({ x: p.x / SUBPX - at.x, y: p.y / SUBPX - at.y }) <= reach
    );
  });
}

function setDoors(state: SimState, ids: readonly EntityId[], open: boolean): void {
  for (const id of ids) {
    const f = getComp(state.entities, id, 'fixture');
    const body = getComp(state.entities, id, 'body');
    if (!f) continue;
    f.open = open;
    if (body) body.solid = !open;
  }
}

/** Puts `count` of a creature around the trigger, on free ground. Returns their ids. */
function spawnWave(state: SimState, at: Vec, creature: string, count: number): EntityId[] {
  const out: EntityId[] = [];
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const x = Math.round(at.x) + int(state.rng.world, -48, 49);
      const y = Math.round(at.y) + int(state.rng.world, -32, 33);
      if (
        state.world &&
        state.world.solidAt(Math.floor(x / TILE), Math.floor((y - 4) / TILE)) !== 0
      )
        continue;
      out.push(spawnCreature(state, creature, x, y));
      break;
    }
  }
  return out;
}

const alive = (state: SimState, id: EntityId): boolean =>
  isAlive(state.entities, id) && getComp(state.entities, id, 'fighter')?.state !== 'dead';

/** Arenas: the doors close when the avatar steps in, waves come one after another, the doors open when the last falls. */
function arenas(state: SimState): void {
  const avatars = query(state.entities, 'avatar', 'pos').filter((a) => alive(state, a));
  const heroDied = state.events.list.some((e) => e.type === 'died' && e.team === 0);
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    const p = getComp(state.entities, id, 'pos');
    if (!f?.arena || !def?.arena || !p) continue;
    const at = { x: p.x / SUBPX, y: p.y / SUBPX - TILE / 2 };
    const doors = fixturesNear(state, def.arena.doors, at, W.arenaDoorReachPx);
    const arena = f.arena;
    if (arena.state === 'idle') {
      const near = avatars.some((a) => {
        const q = getComp(state.entities, a, 'pos');
        return q && len({ x: q.x / SUBPX - at.x, y: q.y / SUBPX - at.y }) <= def.arena!.radius;
      });
      if (!near) continue;
      arena.state = 'live';
      arena.wave = 0;
      const w = def.arena.waves[0];
      arena.foes = w ? spawnWave(state, at, w.creature, w.count) : [];
      setDoors(state, doors, false);
      emit(state.events, { type: 'arenaStarted', id, wave: 0 });
    } else if (arena.state === 'live') {
      if (heroDied) {
        // Falling in the arena resets it: the doors open and the wave is gone, to be tried again.
        for (const foe of arena.foes) removeFoe(state, foe);
        arena.state = 'idle';
        arena.foes = [];
        setDoors(state, doors, true);
        continue;
      }
      if (arena.foes.some((foe) => alive(state, foe))) continue;
      const next = def.arena.waves[arena.wave + 1];
      if (next) {
        arena.wave++;
        arena.foes = spawnWave(state, at, next.creature, next.count);
        emit(state.events, { type: 'arenaStarted', id, wave: arena.wave });
      } else {
        arena.state = 'done';
        arena.foes = [];
        f.open = true;
        setDoors(state, doors, true);
        emit(state.events, { type: 'arenaCleared', id });
      }
    }
  }
}

function removeFoe(state: SimState, id: EntityId): void {
  destroy(state.entities, id);
}

/** Journal flag for a boss brought down: `cleared:<boss id>`. */
export const BOSS_CLEARED = 'cleared:';

/** Delving events: the first entry of each dungeon room, and a dungeon cleared by its boss falling. */
function delving(state: SimState): void {
  for (const e of state.events.list) {
    if (e.type === 'roomChanged') {
      const d = dungeonOfRoom(e.to);
      if (d) emit(state.events, { type: 'delved', who: e.who, dungeon: d, room: e.to });
    }
  }
  const count = state.events.list.length;
  for (let i = 0; i < count; i++) {
    const e = state.events.list[i];
    if (e?.type !== 'bossResolved') continue;
    const dungeon = Object.values(DUNGEONS).find((d) => d.boss === e.boss);
    if (!dungeon) continue;
    for (const who of query(state.entities, 'avatar')) {
      // The boss's chest and any other `needsFlag` thing opens for those who were there.
      const flags = getComp(state.entities, who, 'journal')?.flags;
      const flag = `${BOSS_CLEARED}${e.boss}`;
      if (flags && !flags.includes(flag)) flags.push(flag);
      emit(state.events, { type: 'dungeonCleared', who, dungeon: dungeon.id });
    }
  }
}

/** Tide gates stand open while the tide is out and shut while it is in. */
function tides(state: SimState): void {
  const low = tideLow(state.worldTick);
  for (const id of query(state.entities, 'fixture')) {
    const f = getComp(state.entities, id, 'fixture');
    if (!f || FIXTURES[f.kind]?.tide !== 'low' || f.open === low) continue;
    f.open = low;
    const body = getComp(state.entities, id, 'body');
    if (body) body.solid = !low;
    emit(state.events, { type: low ? 'gateOpened' : 'gateClosed', id });
  }
}

/** True if any fixture of this kind is open (a switch on, a basin filled). */
function anyOpen(state: SimState, kind: string): boolean {
  for (const id of query(state.entities, 'fixture')) {
    const f = getComp(state.entities, id, 'fixture');
    if (f?.kind === kind && f.open) return true;
  }
  return false;
}

/** Water gates stand open when the water is at the level they want. Low water: a sluice is on. */
function waters(state: SimState): void {
  for (const id of query(state.entities, 'fixture')) {
    const f = getComp(state.entities, id, 'fixture');
    const w = f ? FIXTURES[f.kind]?.water : undefined;
    if (!f || !w) continue;
    const high = !anyOpen(state, w.sluice) || (w.basin !== undefined && anyOpen(state, w.basin));
    const open = w.when === 'high' ? high : !high;
    if (f.open === open) continue;
    f.open = open;
    const body = getComp(state.entities, id, 'body');
    if (body) body.solid = !open;
    emit(state.events, { type: open ? 'gateOpened' : 'gateClosed', id });
  }
}

/** Vents burst on their cycle, once, and hurt every avatar within reach. */
function vents(state: SimState): void {
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const v = f ? FIXTURES[f.kind]?.vent : undefined;
    const p = getComp(state.entities, id, 'pos');
    if (!v || !p) continue;
    // A vent's own place in the cycle comes from where it stands, so a row of them is not in step.
    const t = (state.tick + ((p.x >> 8) * 7 + (p.y >> 8) * 13)) % v.period;
    f!.open = t >= v.telegraph && t < v.telegraph + v.active;
    if (t !== v.telegraph) continue;
    for (const a of query(state.entities, 'avatar', 'pos')) {
      if (!alive(state, a)) continue;
      const q = getComp(state.entities, a, 'pos');
      if (q && len({ x: (q.x - p.x) / SUBPX, y: (q.y - p.y) / SUBPX }) <= v.radius)
        drain(state, a, v.damage, id, 'hazard');
    }
  }
}

/** Secrets: standing at a vigil the right way sets its flag, once. Checked twice a second. */
function vigils(state: SimState): void {
  if (state.worldTick % 15 !== 0) return;
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const s = f ? FIXTURES[f.kind]?.secret : undefined;
    const p = getComp(state.entities, id, 'pos');
    if (!s || !p) continue;
    for (const a of query(state.entities, 'avatar', 'pos')) {
      if (!alive(state, a)) continue;
      const q = getComp(state.entities, a, 'pos');
      const flags = getComp(state.entities, a, 'journal')?.flags;
      if (!q || !flags || flags.includes(s.flag)) continue;
      if (len({ x: (q.x - p.x) / SUBPX, y: (q.y - p.y) / SUBPX }) > s.radius) continue;
      if (s.need && pointsOf(state, a, s.need.skill) < s.need.points) continue;
      if (s.minutes) {
        const m = minuteOfDay(state.worldTick);
        if (m < s.minutes[0] || m >= s.minutes[1]) continue;
      }
      if (s.weather === 'clear' && currentWeather(state) !== 'clear') continue;
      const give = (flag: string): void => {
        if (flags.includes(flag)) return;
        flags.push(flag);
        emit(state.events, { type: 'flagSet', who: a, flag });
      };
      if (s.phases) {
        give(`${s.flag}.${dayPhase(state.worldTick)}`);
        if (s.phases.every((ph) => flags.includes(`${s.flag}.${ph}`))) give(s.flag);
      } else give(s.flag);
    }
  }
}

/** Once per tick, after the fixtures system. */
export function dungeonSystem(state: SimState): void {
  arenas(state);
  tides(state);
  waters(state);
  vents(state);
  vigils(state);
  delving(state);
}
