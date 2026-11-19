/**
 * Waystones (POW-M4-07). Touching a stone attunes it, binds the respawn point to it and heals.
 * Between attuned stones of one region travel is free, from a Waystone or from the map, except
 * in a dungeon or soon after a fight.
 */
import { COMBAT as C } from '../../content/balance/combat';
import { roomAt } from '../../content/world/rooms';
import { dungeonOfRoom } from '../../content/world/dungeons';
import { WAYSTONES, stoneKey, stoneAtTile } from '../../content/world/waystones';
import { getComp, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { SUBPX, px } from '../kernel/fixed';
import type { SimState } from '../state';
import { chunkOfPx } from '../world/window';

const TILE = 16;
const NO_REGION = 'slice';

/**
 * Why travel is refused. `combat` means the avatar is fighting or has been within the time Health
 * waits before it regenerates (`COMBAT.pools.hpRegenDelay`), the game's own measure of out of combat.
 */
export type TravelBlock = 'unknown' | 'unattuned' | 'dungeon' | 'combat' | 'loading' | 'here';

/** Stones the avatar has attuned in a region, by id. */
export function attunedIn(state: SimState, region: string): string[] {
  const prefix = `${region}:`;
  return state.map.waystones.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

/** Records a first touch. Returns true if the stone was new. */
export function attune(state: SimState, who: EntityId, region: string, stone: string): boolean {
  const key = stoneKey(region, stone);
  if (state.map.waystones.includes(key)) return false;
  state.map.waystones.push(key);
  emit(state.events, { type: 'waystoneAttuned', who, region, stone });
  return true;
}

/** The stone a Waystone fixture is, from where it stands. Null for a stone the region does not list. */
export function stoneOfFixture(state: SimState, id: EntityId): string | null {
  const p = getComp(state.entities, id, 'pos');
  if (!p) return null;
  const tx = Math.floor(p.x / SUBPX / TILE);
  const ty = Math.floor((p.y / SUBPX - 1) / TILE);
  return stoneAtTile(state.region ?? NO_REGION, tx, ty)?.id ?? null;
}

/** Whether the avatar may travel to `stone` now. */
export function travelBlock(state: SimState, who: EntityId, stone: string): TravelBlock | null {
  const region = state.region ?? NO_REGION;
  const def = WAYSTONES[region]?.find((w) => w.id === stone);
  const pos = getComp(state.entities, who, 'pos');
  const f = getComp(state.entities, who, 'fighter');
  const pools = getComp(state.entities, who, 'pools');
  if (!def || !pos || !f || !pools) return 'unknown';
  if (!state.map.waystones.includes(stoneKey(region, stone))) return 'unattuned';
  const tx = Math.floor(pos.x / SUBPX / TILE);
  const ty = Math.floor((pos.y / SUBPX - 1) / TILE);
  const room = roomAt(tx, ty);
  // Any room that is not open ground (the cave, a dungeon's rooms) counts as a dungeon.
  if (room && (!room.outdoors || dungeonOfRoom(room.id))) return 'dungeon';
  if (f.state !== 'idle' || state.tick - pools.lastCombat < C.pools.hpRegenDelay) return 'combat';
  if (Math.abs(tx - def.x) <= 3 && Math.abs(ty - def.y) <= 3) return 'here';
  // The stone's own chunk must be in. The game loads the chunks around it before it sends the
  // command, so the avatar never lands in ground that is not there.
  const stream = state.stream;
  if (stream && !stream.source.chunk(chunkOfPx(def.x * TILE), chunkOfPx(def.y * TILE)))
    return 'loading';
  return null;
}

/** Moves the avatar to just south of an attuned stone. Returns whether it went. */
export function travelTo(state: SimState, who: EntityId, stone: string): boolean {
  if (travelBlock(state, who, stone) !== null) return false;
  const region = state.region ?? NO_REGION;
  const def = WAYSTONES[region]?.find((w) => w.id === stone);
  const pos = getComp(state.entities, who, 'pos');
  const vel = getComp(state.entities, who, 'vel');
  const a = getComp(state.entities, who, 'avatar');
  const f = getComp(state.entities, who, 'fighter');
  if (!def || !pos || !a || !f) return false;
  const from = nearestStone(region, pos.x, pos.y);
  // Wake just south of the stone, as a respawn does.
  pos.x = px(def.x * TILE + TILE / 2);
  pos.y = px(def.y * TILE + TILE + 12);
  if (vel) {
    vel.x = 0;
    vel.y = 0;
  }
  a.intent = null;
  a.full = false;
  f.lock = null;
  emit(state.events, { type: 'traveled', who, region, from, to: stone });
  return true;
}

function nearestStone(region: string, x: number, y: number): string | null {
  let best: string | null = null;
  let d2 = Infinity;
  for (const w of WAYSTONES[region] ?? []) {
    const dx = x / SUBPX / TILE - w.x;
    const dy = y / SUBPX / TILE - w.y;
    if (dx * dx + dy * dy < d2) {
      d2 = dx * dx + dy * dy;
      best = w.id;
    }
  }
  return best;
}
