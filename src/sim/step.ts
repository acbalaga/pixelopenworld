import { tick, type System, type TickInput } from './kernel/scheduler';
import { dirStep } from './kernel/fixed';
import { setComp, isAlive } from './kernel/entities';
import type { Command } from './kernel/commands';
import { driftSystem } from './systems/drift';
import type { SimState } from './state';
import { applyAvatarCommand } from './avatar';
import { movementSystem } from './systems/movement';
import type { EntityId } from './kernel/entities';

/** Systems in fixed run order. */
export const SYSTEMS: readonly System<SimState>[] = [driftSystem];

/** Demo handler: `move` sets the velocity of entity 0. */
function handle(state: SimState, c: Command): void {
  if (c.type === 'move' && isAlive(state.entities, 0)) {
    const s = c.dir === null ? { x: 0, y: 0 } : dirStep(c.dir);
    setComp(state.entities, 0, 'vel', { x: s.x * 128, y: s.y * 128 });
  }
}

/** Advances the sim one tick. Returns the number of rejected commands. */
export function step(state: SimState, input: TickInput): number {
  return tick(state, SYSTEMS, input, handle);
}

/** Systems for a world with an avatar, in run order. */
export const WORLD_SYSTEMS: readonly System<SimState>[] = [movementSystem];

/** Advances a world with an avatar (entity `who`) one tick. Returns rejected command count. */
export function stepWorld(state: SimState, who: EntityId, input: TickInput): number {
  return tick(state, WORLD_SYSTEMS, input, (s, c) => applyAvatarCommand(s, who, c));
}
