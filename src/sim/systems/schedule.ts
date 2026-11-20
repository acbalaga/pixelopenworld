/**
 * People keep their schedules (POW-M4-12). Every `checkTicks`, each named person is asked where
 * the schedule puts them now. If they are not there, and neither the spot they stand at nor the
 * one they should be at can be seen by any avatar, they are set down on their slot at the new
 * place. No one walks, and no one ever moves in view. A place with no standing tiles yet (the
 * Cairnmoor well) leaves its people where they are. The region's map only: other maps place
 * their people by hand. Nothing here is saved; where a person stands is already in their position.
 */
import { PEOPLE } from '../../content/people';
import { PLACES } from '../../content/people/places';
import { PEOPLE_BALANCE as PB } from '../../content/balance/people';
import { getComp, query } from '../kernel/entities';
import { px } from '../kernel/fixed';
import { placeOf } from '../people';
import type { SimState } from '../state';
import { currentWeather, dayPhase } from '../time';

const TILE = 16;

/** Who stands where: each place's visitors in a fixed order, so each takes their own slot. */
const VISITORS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const p of Object.values(PEOPLE))
    for (const place of new Set([p.home, p.work, ...p.schedule.map((s) => s.place)])) {
      const list = m.get(place) ?? [];
      list.push(p.npc);
      m.set(place, list);
    }
  return m;
})();

/** The tile a person stands on at a place, or null if the place has no standing tiles. */
export function slotFor(npc: string, place: string): readonly [number, number] | null {
  const slots = PLACES[place]?.spot?.slots;
  if (!slots || slots.length === 0) return null;
  const rank = Math.max(0, (VISITORS.get(place) ?? []).indexOf(npc));
  return slots[rank % slots.length] ?? null;
}

/** How many people share a place, for the test that each has a slot of their own. */
export function visitorsOf(place: string): readonly string[] {
  return VISITORS.get(place) ?? [];
}

function seen(watchers: readonly { x: number; y: number }[], x: number, y: number): boolean {
  for (const w of watchers)
    if (Math.abs(w.x - x) <= px(PB.viewHalfXPx) && Math.abs(w.y - y) <= px(PB.viewHalfYPx))
      return true;
  return false;
}

export function scheduleSystem(state: SimState): void {
  if (state.region !== 'dawnmeadow') return;
  if (state.worldTick % PB.checkTicks !== 0) return;
  const phase = dayPhase(state.worldTick);
  const weather = currentWeather(state);
  const watchers: { x: number; y: number }[] = [];
  for (const id of query(state.entities, 'avatar', 'pos')) {
    const p = getComp(state.entities, id, 'pos');
    if (p) watchers.push({ x: p.x, y: p.y });
  }
  for (const id of query(state.entities, 'npc', 'pos')) {
    const n = getComp(state.entities, id, 'npc');
    const pos = getComp(state.entities, id, 'pos');
    const person = n ? PEOPLE[n.id] : undefined;
    if (!n || !pos || !person) continue;
    const slot = slotFor(n.id, placeOf(person, phase, weather));
    if (!slot) continue;
    const tx = Math.floor(pos.x / px(TILE));
    const ty = Math.floor(pos.y / px(TILE));
    if (Math.max(Math.abs(tx - slot[0]), Math.abs(ty - slot[1])) <= PB.atPlaceTiles) continue;
    const x = px(slot[0] * TILE + 8);
    const y = px(slot[1] * TILE + 14);
    if (seen(watchers, pos.x, pos.y) || seen(watchers, x, y)) continue;
    pos.x = x;
    pos.y = y;
  }
}
