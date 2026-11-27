/**
 * The map (POW-M4-06). Each tick the avatar uncovers the fog around it, by a radius that grows
 * with Cartography, and Cartography earns XP for every block uncovered for the first time (once
 * `MAP_BALANCE.awakenBlocks` have been uncovered, see `revealPay`). The
 * Menu's map and the minimap only read what this keeps.
 *
 * Fog is kept per region. A chunk the region does not have is never marked, so the avatar at the
 * edge does not fill the saved fog with ground that is not there.
 */
import { MAP_BALANCE } from '../../content/balance/map';
import { RUMORS } from '../../content/world/rumors';
import { cleanNoteText } from '../kernel/commands';
import { getComp, query, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import { isAwake, pointsOf } from '../skills';
import type { SimState } from '../state';
import { blockOf, countRevealed, revealDisc, revealRadius, type Fog } from '../world/fog';

const TILE = 16;
/** Key of the fog kept when no region is named (the slice, tests). */
export const NO_REGION = 'slice';

/** The fog of the region being played. Made on first use. */
export function regionFog(state: SimState, region: string = state.region ?? NO_REGION): Fog {
  return (state.map.fog[region] ??= {});
}

/** The last place each state revealed from, so a still avatar costs one comparison a tick. */
const last = new WeakMap<object, { bx: number; by: number; r: number; region: string }>();

/** Uncovers the map around every avatar. */
export function mapSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'pos')) {
    const pos = getComp(state.entities, who, 'pos');
    const f = getComp(state.entities, who, 'fighter');
    if (!pos || f?.state === 'dead') continue;
    const region = state.region ?? NO_REGION;
    const bx = blockOf(Math.floor(pos.x / SUBPX / TILE));
    const by = blockOf(Math.floor((pos.y / SUBPX - 1) / TILE));
    const r = revealRadius(pointsOf(state, who, 'skill.cartography'));
    const was = last.get(state);
    if (was && was.bx === bx && was.by === by && was.r === r && was.region === region) continue;
    last.set(state, { bx, by, r, region });
    const stream = state.stream;
    const exists = stream ? (cx: number, cy: number) => !!stream.source.chunk(cx, cy) : undefined;
    const fresh = revealDisc(regionFog(state, region), bx, by, r, exists);
    // A chunk that had not arrived yet is not marked. Forget the spot so the next tick tries again
    // while any wanted chunk is still missing.
    if (stream?.pending) last.delete(state);
    if (fresh > 0) emit(state.events, { type: 'revealed', who, blocks: fresh });
  }
}

/** Every block uncovered, in every region. */
export function totalRevealed(state: SimState): number {
  let n = 0;
  for (const fog of Object.values(state.map.fog)) n += countRevealed(fog);
  return n;
}

/**
 * How many blocks a reveal of `fresh` new blocks pays Cartography for. While Cartography sleeps,
 * nothing, until `MAP_BALANCE.awakenBlocks` have been uncovered in all. The reveal that reaches it
 * pays for every block so far, so the skill wakes with XP equal to the ground it has covered.
 */
export function revealPay(state: SimState, who: EntityId, fresh: number): number {
  const s = getComp(state.entities, who, 'skills');
  if (!s || isAwake(s, 'skill.cartography')) return fresh;
  const total = totalRevealed(state);
  return total >= MAP_BALANCE.awakenBlocks ? total : 0;
}

/** Adds a note at world tile (x, y). Returns its id, or null if the text is empty or the page is full. */
export function addNote(state: SimState, x: number, y: number, raw: string): number | null {
  const text = cleanNoteText(raw);
  const m = state.map;
  if (text === null || m.notes.length >= MAP_BALANCE.notes.max) return null;
  const id = m.nextNote++;
  m.notes.push({ id, x, y, text });
  return id;
}

/** Removes a note. Returns whether it existed. */
export function removeNote(state: SimState, id: number): boolean {
  const i = state.map.notes.findIndex((n) => n.id === id);
  if (i < 0) return false;
  state.map.notes.splice(i, 1);
  return true;
}

/** Records a rumor the avatar was told. Unknown ids and repeats change nothing. */
export function hearRumor(state: SimState, who: EntityId, id: string): boolean {
  if (!RUMORS[id] || state.map.rumors.includes(id)) return false;
  state.map.rumors.push(id);
  emit(state.events, { type: 'rumorHeard', who, rumor: id });
  return true;
}
