import { CREATURES } from '../../content/creatures';
import { setComp, spawn, type EntityId } from '../kernel/entities';
import { px } from '../kernel/fixed';
import type { SimState } from '../state';
import { newFighter } from './fighter';

/**
 * Creates a creature from its data, standing at a feet position in whole px, with its brain.
 * `spawner` is the entity that made it, or -1.
 */
export function spawnCreature(
  state: SimState,
  creatureId: string,
  xPx: number,
  yPx: number,
  spawner = -1,
  brain = true,
): EntityId {
  const def = CREATURES[creatureId];
  if (!def) throw new Error(`unknown creature ${creatureId}`);
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
    weapon: 'claws',
    power: def.power,
    defense: def.defense,
    skillRank: 0,
    name: def.name,
    kind: def.id,
    tier: def.tier,
  });
  setComp(state.entities, id, 'stagger', { cur: 0, max: def.staggerMax, lastHit: -1000 });
  if (brain)
    setComp(state.entities, id, 'ai', {
      creature: def.id,
      state: 'idle',
      t: 0,
      home: { x: px(xPx), y: px(yPx) },
      target: null,
      cooldowns: def.attacks.map(() => 0),
      phase: 0,
      heading: 4,
      spawner,
      fled: false,
    });
  return id;
}

/** A creature with no brain: it stands and can be hit. For scenario tests of the fighting rules. */
export function spawnEnemy(
  state: SimState,
  creatureId: string,
  xPx: number,
  yPx: number,
): EntityId {
  return spawnCreature(state, creatureId, xPx, yPx, -1, false);
}
