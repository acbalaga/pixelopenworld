import { COMBAT as C } from '../../content/balance/combat';
import { getComp, query } from '../kernel/entities';
import type { SimState } from '../state';
import { nudge } from './movement';

/**
 * Pool regeneration (design/04). Health only after a quiet spell. Stamina fast, after a short
 * delay. Focus slowly, faster while standing still.
 */
export function poolsSystem(state: SimState): void {
  for (const id of query(state.entities, 'pools', 'fighter')) {
    const p = getComp(state.entities, id, 'pools');
    const f = getComp(state.entities, id, 'fighter');
    if (!p || !f || f.state === 'dead') continue;
    const t = state.tick;
    if (t - p.lastCombat >= C.pools.hpRegenDelay && t % C.pools.hpRegenEvery === 0)
      p.hp = Math.min(p.hpMax, p.hp + 1);
    if (t - p.lastSpend >= C.pools.staRegenDelay)
      p.sta = Math.min(p.staMax, p.sta + C.pools.staRegen);
    const v = getComp(state.entities, id, 'vel');
    const still = !v || (v.x === 0 && v.y === 0);
    const every = still ? C.pools.focRegenStillEvery : C.pools.focRegenEvery;
    if (t % every === 0) p.foc = Math.min(p.focMax, p.foc + 1);
  }
}

/** Applies pending knockback to anything with a body, with collision. */
export function knockSystem(state: SimState): void {
  for (const id of query(state.entities, 'knock', 'pos', 'body')) {
    const k = getComp(state.entities, id, 'knock');
    if (!k) continue;
    nudge(state, id, k.x, k.y);
    k.ttl--;
    if (k.ttl <= 0) state.entities.comps.knock[id] = null;
  }
}
