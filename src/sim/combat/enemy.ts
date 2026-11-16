import { ENEMIES } from '../../content/combat/enemies';
import { WEAPONS } from '../../content/combat/attacks';
import { setComp, spawn, type EntityId } from '../kernel/entities';
import { px } from '../kernel/fixed';
import type { SimState } from '../state';
import { newFighter } from './fighter';

/** Creates a creature from its combat data, standing at a feet position in whole px. */
export function spawnEnemy(state: SimState, defId: string, xPx: number, yPx: number): EntityId {
  const def = ENEMIES[defId];
  if (!def) throw new Error(`unknown enemy ${defId}`);
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x: px(xPx), y: px(yPx) });
  setComp(state.entities, id, 'vel', { x: 0, y: 0 });
  setComp(state.entities, id, 'body', { w: px(def.bodyW), h: px(def.bodyH), solid: true });
  setComp(state.entities, id, 'pools', {
    hp: def.hp,
    hpMax: def.hp,
    sta: 1000,
    staMax: 1000,
    foc: 1000,
    focMax: 1000,
    lastCombat: state.tick,
    lastSpend: state.tick,
  });
  setComp(state.entities, id, 'fighter', newFighter(1));
  setComp(state.entities, id, 'combatant', {
    weapon: def.weapon,
    power: def.power || (WEAPONS[def.weapon]?.power ?? 1),
    defense: def.defense,
    skillRank: 0,
    name: def.name,
  });
  setComp(state.entities, id, 'stagger', { cur: 0, max: def.staggerMax, lastHit: -1000 });
  return id;
}
