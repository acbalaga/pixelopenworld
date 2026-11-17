import { MOVEMENT as M } from '../content/balance/movement';
import { Dir, px } from './kernel/fixed';
import { setComp, spawn, type EntityId } from './kernel/entities';
import type { Command } from './kernel/commands';
import { applyFighterCommand } from './combat/commands';
import { newFighter, newPools } from './combat/fighter';
import { WEAPONS } from '../content/combat/attacks';
import type { SimState } from './state';
import { newSkills } from './skills';

/** Creates the avatar standing at a feet position (sub-pixel units), facing south. Returns its id. */
export function createAvatar(state: SimState, x: number, y: number): EntityId {
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x, y });
  setComp(state.entities, id, 'vel', { x: 0, y: 0 });
  setComp(state.entities, id, 'body', {
    w: px(M.bodyW),
    h: px(M.bodyH),
    solid: true,
  });
  setComp(state.entities, id, 'avatar', {
    facing: Dir.S,
    intent: null,
    full: false,
    fullTicks: 0,
    sprinting: false,
    coin: 0,
    respawn: { x, y },
    winded: false,
  });
  setComp(state.entities, id, 'pools', newPools(state.tick));
  setComp(
    state.entities,
    id,
    'fighter',
    newFighter(0, ['technique.blades_lunge', 'technique.ember_bolt']),
  );
  setComp(state.entities, id, 'combatant', {
    weapon: 'sword',
    power: WEAPONS.sword?.power ?? 10,
    defense: 0,
    skillRank: 0,
    name: 'You',
    kind: 'avatar',
    tier: 0,
  });
  setComp(state.entities, id, 'skills', newSkills());
  return id;
}

/** Applies a command to the avatar entity `who`. */
export function applyAvatarCommand(state: SimState, who: EntityId, c: Command): void {
  const a = state.entities.comps.avatar[who];
  if (!a) return;
  if (c.type === 'move') {
    a.intent = c.dir;
    a.full = c.dir !== null && c.full === true;
    return;
  }
  applyFighterCommand(state, who, c);
}

/** Feet position for a tile corner plus offset, in sub-pixel units. For spawning and tests. */
export function feetAt(
  tileX: number,
  tileY: number,
  offX = 8,
  offY = 14,
): { x: number; y: number } {
  return { x: px(tileX * 16 + offX), y: px(tileY * 16 + offY) };
}
