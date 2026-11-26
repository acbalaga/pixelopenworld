import { tick, type System, type TickInput } from './kernel/scheduler';
import { dirStep } from './kernel/fixed';
import { setComp, isAlive } from './kernel/entities';
import type { Command } from './kernel/commands';
import { driftSystem } from './systems/drift';
import type { SimState } from './state';
import { applyAvatarCommand } from './avatar';
import { aiSystem } from './systems/ai';
import { combatSystem } from './systems/combat';
import { roamSystem } from './systems/roamers';
import { spawnerSystem } from './systems/spawner';
import { streamSystem } from './world/stream';
import { dungeonSystem } from './systems/dungeon';
import { thiefSystem } from './systems/thief';
import { bossSystem } from './systems/boss';
import { movementSystem } from './systems/movement';
import { knockSystem, poolsSystem } from './systems/pools';
import { projectileSystem } from './systems/projectile';
import { hintsSystem } from './systems/hints';
import { boardsSystem } from './systems/boards';
import { mapSystem } from './systems/map';
import { bestiarySystem } from './systems/bestiary';
import { singularsSystem } from './systems/singulars';
import { requestsSystem } from './systems/requests';
import { fixturesSystem } from './systems/fixtures';
import { itemsSystem } from './systems/items';
import { wearSystem } from './items';
import { skillsSystem } from './systems/skills';
import { trialsSystem } from './systems/trials';
import { craftSystem } from './crafting';
import { elementsSystem } from './elements';
import { tradeSystem } from './trade';
import { scheduleSystem } from './systems/schedule';
import { travelersSystem } from './travelers/crowd';
import { chatSystem, socialSystem } from './chat/engine';
import { duelSystem } from './duel';
import { pitSystem } from './travelers/pit';
import { rankingsSystem } from './rankings/system';
import { snareSystem } from './gadgets';
import { deedsSystem, pathsSystem } from './systems/deeds';
import { channelSystem } from './combat/techniques';
import { statusSystem } from './statuses';
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
export const WORLD_SYSTEMS: readonly System<SimState>[] = [
  streamSystem,
  spawnerSystem,
  roamSystem,
  aiSystem,
  combatSystem,
  duelSystem,
  thiefSystem,
  movementSystem,
  fixturesSystem,
  bossSystem,
  dungeonSystem,
  snareSystem,
  knockSystem,
  projectileSystem,
  channelSystem,
  elementsSystem,
  statusSystem,
  poolsSystem,
  itemsSystem,
  craftSystem,
  requestsSystem,
  boardsSystem,
  tradeSystem,
  scheduleSystem,
  travelersSystem,
  chatSystem,
  rankingsSystem,
  socialSystem,
  pitSystem,
  hintsSystem,
  // Last, so they see every event the other systems sent this tick. Trials run before skills,
  // so a pass releases banked XP in the same tick. A system that emits an event `skillsSystem` or
  // `trialsSystem` reads must run before them: `tick()` clears events at the start of each tick, so
  // an event sent after them is never read. The map is one (`revealed`). It reads Cartography
  // from the end of the previous tick, a lag of one tick that is accepted.
  mapSystem,
  wearSystem,
  trialsSystem,
  skillsSystem,
  deedsSystem,
  pathsSystem,
  singularsSystem,
  bestiarySystem,
];

/** Advances a world with an avatar (entity `who`) one tick. Returns rejected command count. */
export function stepWorld(state: SimState, who: EntityId, input: TickInput): number {
  return tick(state, WORLD_SYSTEMS, input, (s, c) => applyAvatarCommand(s, who, c));
}
