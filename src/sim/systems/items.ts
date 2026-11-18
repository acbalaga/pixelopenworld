import { ITEMS_BALANCE as B } from '../../content/balance/items';
import { CREATURES } from '../../content/creatures';
import { NODES } from '../../content/items/recipes';
import { len } from '../combat/geometry';
import { destroy, getComp, query } from '../kernel/entities';
import { emit } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import { int } from '../kernel/rng';
import { tickGather } from '../gathering';
import { canHold, collect, rollDrops, spawnPickup } from '../items';
import { recomputePools } from '../skills';
import type { SimState } from '../state';
import { contextTarget } from './interact';
import { madeItems } from '../ledger';

/** Creatures that died this tick leave their drops, scattered a little, popping out. */
function dropLoot(state: SimState): void {
  const count = state.events.list.length;
  for (let i = 0; i < count; i++) {
    const e = state.events.list[i];
    if (!e || e.type !== 'died' || e.team !== 1) continue;
    const kind = getComp(state.entities, e.id, 'combatant')?.kind;
    const p = getComp(state.entities, e.id, 'pos');
    const def = kind ? CREATURES[kind] : undefined;
    if (!def || !p) continue;
    for (const d of rollDrops(state.rng.loot, def.drops)) {
      const s = B.loot.scatterPx;
      const dx = int(state.rng.loot, -s, s) * SUBPX;
      const dy = int(state.rng.loot, -s, s) * SUBPX;
      spawnPickup(state, d.item, d.qty, p.x + dx, p.y + dy);
      if (d.item !== 'item.coin') madeItems(state, 'loot', d.item, d.qty);
    }
  }
}

/** Pickups age, slide toward a close avatar, are taken, or fade. */
function pickups(state: SimState): void {
  const avatars = query(state.entities, 'avatar', 'pos', 'inventory');
  for (const id of query(state.entities, 'pickup', 'pos')) {
    const pk = getComp(state.entities, id, 'pickup');
    const pos = getComp(state.entities, id, 'pos');
    if (!pk || !pos) continue;
    pk.age++;
    if (pk.age >= B.loot.lifeTicks) {
      destroy(state.entities, id);
      continue;
    }
    if (pk.age < B.loot.popTicks) continue;
    let best = -1;
    let bestD = Infinity;
    for (const a of avatars) {
      if (getComp(state.entities, a, 'fighter')?.state === 'dead') continue;
      const ap = getComp(state.entities, a, 'pos');
      if (!ap) continue;
      const d = len({ x: (ap.x - pos.x) / SUBPX, y: (ap.y - pos.y) / SUBPX });
      if (d < bestD) {
        best = a;
        bestD = d;
      }
    }
    if (best < 0) continue;
    if (bestD <= B.loot.collectPx) {
      collect(state, best, id);
      continue;
    }
    const inv = getComp(state.entities, best, 'inventory');
    const holdable = pk.item === 'item.coin' || (inv ? canHold(inv, pk.item) : false);
    if (bestD <= B.loot.magnetPx && holdable) {
      const ap = getComp(state.entities, best, 'pos');
      if (!ap) continue;
      const k = (B.loot.magnetSpeedPx * SUBPX) / Math.max(bestD, 1) / SUBPX;
      const step = Math.min(1, k);
      pos.x += Math.round((ap.x - pos.x) * step);
      pos.y += Math.round((ap.y - pos.y) * step);
    }
  }
}

/** Gathers run out their sweep, cancel if the avatar leaves, and spent nodes come back. */
function nodes(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'inventory')) {
    const g = getComp(state.entities, who, 'gather');
    if (!g) continue;
    const gone =
      getComp(state.entities, who, 'fighter')?.state !== 'idle' ||
      contextTarget(state, who) !== g.node;
    if (gone) {
      state.entities.comps.gather[who] = null;
      emit(state.events, { type: 'gatherCancelled', id: who, node: g.node });
      continue;
    }
    tickGather(state, who);
  }
  for (const id of query(state.entities, 'node')) {
    const n = getComp(state.entities, id, 'node');
    if (n && NODES[n.kind] && n.readyAt === state.worldTick)
      emit(state.events, { type: 'nodeReady', id });
  }
}

/** The Fed buff ends on time. */
function fed(state: SimState): void {
  for (const who of query(state.entities, 'fed')) {
    const f = getComp(state.entities, who, 'fed');
    if (!f || state.tick < f.until) continue;
    state.entities.comps.fed[who] = null;
    recomputePools(state, who);
    emit(state.events, { type: 'fedEnded', id: who, item: f.item });
  }
}

/** Loot, pickups, gathering and buffs, once per tick. Runs before skills so XP sees gathers. */
export function itemsSystem(state: SimState): void {
  dropLoot(state);
  pickups(state);
  nodes(state);
  fed(state);
}
