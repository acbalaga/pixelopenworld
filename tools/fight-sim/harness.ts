import { ATTACKS, WEAPONS } from '../../src/content/combat/attacks';
import { TECHNIQUES } from '../../src/content/combat/techniques';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { assign, learnTechnique } from '../../src/sim/combat/techniques';
import { equip, give } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { Direction } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { recomputePools } from '../../src/sim/skills';
import { stepWorld } from '../../src/sim/step';
import type { Build } from './builds';

export const TPS = 30;
const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 90 || ty > 90 ? 1 : 0),
};
/** Facing east. */
const E = 2;

/** One fight, as numbers. */
export interface FightResult {
  /** Seconds from the first tick to the creature's death. Null when it was not down in time. */
  ttk: number | null;
  /** Health the avatar lost. */
  damage: number;
  /** Stamina and Focus spent, in whole points (the pools are in tenths). */
  staSpent: number;
  focSpent: number;
  /** The avatar fell before the creature did. */
  died: boolean;
  /** Pieces of bread eaten. */
  eaten: number;
}

/** The longest a fight may last, in seconds, before it counts as not won. */
export const MAX_SECONDS = 240;

/** Dresses the avatar for a build at a tier's par rank. */
function dress(s: SimState, me: number, build: Build, tier: 1 | 2, rank: number): string[] {
  const sk = s.entities.comps.skills[me]!;
  sk.points[build.skill] = rank;
  const weapon = build.weapon?.[tier];
  if (weapon) {
    give(s, me, weapon, 1, 'start');
    const inv = s.entities.comps.inventory[me]!;
    equip(
      s,
      me,
      inv.slots.findIndex((x) => x?.item === weapon),
    );
  }
  const spells = build.spells?.[tier] ?? [];
  spells.forEach((id, i) => {
    const t = TECHNIQUES[id]!;
    if (t.band <= rank) {
      learnTechnique(s, me, id);
      assign(s, me, i + 1, id);
    }
  });
  recomputePools(s, me);
  const pools = s.entities.comps.pools[me]!;
  pools.hp = pools.hpMax;
  pools.sta = pools.staMax;
  pools.foc = pools.focMax;
  return spells.filter((id) => TECHNIQUES[id]!.band <= rank);
}

/**
 * One headless fight on the real sim: the avatar at (30, 30) facing east, the creature one tile
 * east. The policy is the plain one a player learns first: swing every tick, cast the best spell
 * that is affordable and off cooldown, dodge on a fixed rhythm. It is the same for every build,
 * so the numbers compare builds, not policies.
 */
export function fight(
  build: Build,
  tier: 1 | 2,
  rank: number,
  creature: string,
  seed: number,
): FightResult {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  const f = feetAt(30, 30);
  const me = createAvatar(s, f.x, f.y, 'Sim_1');
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds, worldTick: s.tick + 1 });
  };
  tick({ type: 'scheme', scheme: 'classic' });
  tick({ type: 'move', dir: E });
  tick({ type: 'move', dir: null });
  const spells = dress(s, me, build, tier, rank);
  give(s, me, FOOD, 6, 'start');
  // The seed varies how the fight starts: how far the creature stands (14 to 22 px) and how long
  // the player waits before the first swing (0 to 9 ticks), so a run is a spread, not one number.
  const j = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0;
  const gap = 14 + (j % 9);
  const wait = (j >>> 8) % 10;
  const foe = spawnCreature(s, creature, 30 * 16 + 8 + gap, 30 * 16 + 14, -1);
  for (let i = 0; i < wait; i++) tick();
  const pools = s.entities.comps.pools[me]!;
  const startHp = pools.hp;
  let sta = pools.sta;
  let foc = pools.foc;
  let staSpent = 0;
  let focSpent = 0;
  const t0 = s.tick;
  const cd = new Map<string, number>();
  const weapon = WEAPONS[s.entities.comps.combatant[me]!.weapon];
  // How close the policy stands: a melee weapon at its reach, a bow from a distance, and a spell
  // from inside the reach of its projectile (a stone flies only a few tiles).
  const reachOf = (id: string): number => {
    const a = ATTACKS[TECHNIQUES[id]?.attack ?? ''];
    return a?.projectile ? a.projectile.speed * a.projectile.ttl : 90;
  };
  const engage =
    build.kind === 'magic'
      ? Math.min(90, Math.min(...spells.map(reachOf)) * 0.7)
      : weapon?.family === 'archery'
        ? 90
        : (weapon?.reach ?? 20) * 0.85;
  let ttk: number | null = null;
  let died = false;
  let eaten = 0;
  const max = MAX_SECONDS * TPS;
  const here = (id: number): { x: number; y: number } => {
    const p = s.entities.comps.pos[id]!;
    return { x: p.x / 256, y: p.y / 256 };
  };
  for (let i = 0; i < max; i++) {
    const foeDead = !s.entities.alive[foe] || s.entities.comps.fighter[foe]?.state === 'dead';
    if (foeDead) {
      ttk = (s.tick - t0) / TPS;
      break;
    }
    if (s.entities.comps.fighter[me]?.state === 'dead') {
      died = true;
      break;
    }
    const cmds: Command[] = [];
    const mp = here(me);
    const fp = here(foe);
    const dx = fp.x - mp.x;
    const dy = fp.y - mp.y;
    const dist = Math.hypot(dx, dy);
    // Keep the foe locked, so swings and shots turn to it.
    if (i % 15 === 0 || s.entities.comps.fighter[me]?.lock == null)
      cmds.push({ type: 'lock', x: Math.round(fp.x), y: Math.round(fp.y - 6) });
    // Eat when hurt, the way a player does, from a pack of bread.
    if (pools.hp < 40 && i % 30 === 0) {
      const slot = s.entities.comps.inventory[me]!.slots.findIndex((x) => x?.item === FOOD);
      if (slot >= 0) {
        cmds.push({ type: 'use', slot });
        eaten++;
      }
    }
    // Close the distance; stop at the engaging distance.
    const toward = dirToward(dx, dy);
    cmds.push({ type: 'move', dir: dist > engage ? toward : null });
    const cast = spells.find((id) => {
      const t = TECHNIQUES[id]!;
      return (cd.get(id) ?? 0) <= s.tick && t.cost?.pool === 'foc' && pools.foc >= t.cost.amount;
    });
    if (cast && dist <= engage + 20) {
      cmds.push({ type: 'technique', slot: spells.indexOf(cast) + 1, phase: 'press', aim: toward });
      cd.set(cast, s.tick + (TECHNIQUES[cast]!.cooldown ?? 0));
    } else if (dist <= engage + 6) {
      cmds.push({ type: 'attack' });
    }
    // Dodge on a fixed rhythm, as a player does at a telegraph.
    if (i % 60 === 40) cmds.push({ type: 'dodge', dir: null });
    tick(...cmds);
    if (pools.sta < sta) staSpent += sta - pools.sta;
    if (pools.foc < foc) focSpent += foc - pools.foc;
    sta = pools.sta;
    foc = pools.foc;
  }
  return {
    ttk,
    damage: Math.max(0, startHp - pools.hp),
    staSpent: Math.round(staSpent / 10),
    focSpent: Math.round(focSpent / 10),
    died,
    eaten,
  };
}

/** The food the policy carries: a pack of bread. */
const FOOD = 'item.dish_bread';

/** The nearest of the eight directions toward a vector. */
function dirToward(dx: number, dy: number): Direction {
  const a = Math.atan2(dx, -dy);
  return (((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8) as Direction;
}
