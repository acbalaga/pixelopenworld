import { MOVEMENT as M } from '../content/balance/movement';
import { Dir, px } from './kernel/fixed';
import { setComp, spawn, type EntityId } from './kernel/entities';
import type { Command } from './kernel/commands';
import type { SimState } from './state';

/** Creates the avatar standing at a feet position (sub-pixel units), facing south. Returns its id. */
export function createAvatar(state: SimState, x: number, y: number): EntityId {
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x, y });
  setComp(state.entities, id, 'vel', { x: 0, y: 0 });
  setComp(state.entities, id, 'body', {
    w: px(M.bodyW),
    h: px(M.bodyH),
    solid: false,
  });
  setComp(state.entities, id, 'avatar', {
    facing: Dir.S,
    intent: null,
    full: false,
    fullTicks: 0,
    sprinting: false,
    stamina: M.staminaMax,
    staminaMax: M.staminaMax,
    winded: false,
  });
  return id;
}

/** Applies a command to the avatar entity `who`. */
export function applyAvatarCommand(state: SimState, who: EntityId, c: Command): void {
  const a = state.entities.comps.avatar[who];
  if (!a) return;
  if (c.type === 'move') {
    a.intent = c.dir;
    a.full = c.dir !== null && c.full === true;
  }
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
