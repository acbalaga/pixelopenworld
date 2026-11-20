import { ATTACKS, WEAPONS } from '../../src/content/combat/attacks';
import { TECHNIQUES } from '../../src/content/combat/techniques';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { spawnBoss } from '../../src/sim/systems/boss';
import { query } from '../../src/sim/kernel/entities';
import { applyStep } from '../../src/sim/systems/spawner';
import { assign, learnTechnique } from '../../src/sim/combat/techniques';
import { equip, give } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { Direction } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { recomputePools } from '../../src/sim/skills';
import { stepWorld } from '../../src/sim/step';
import { CREATURES } from '../../src/content/creatures';
import type { CreatureDef, Temperament } from '../../src/content/creatures/types';
import { ARMOR, type Build } from './builds';

/**
 * How a fight begins. `engaged` is the par measure: the creatures are already on the avatar, so
 * the numbers compare builds. A temperament name starts the fight from that nature instead: the
 * creature is unprovoked and the avatar comes to it, so a hostile one chases, a territorial one
 * warns first, a defensive, passive or curious one waits to be hit, and a skittish one runs.
 */
export type FightStart = 'engaged' | Temperament;

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
  for (const piece of ARMOR[tier]) {
    give(s, me, piece, 1, 'start');
    const inv = s.entities.comps.inventory[me]!;
    equip(
      s,
      me,
      inv.slots.findIndex((x) => x?.item === piece),
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
 * One headless fight on the real sim: the avatar at (30, 30) facing east, `count` creatures
 * standing a tile or so away in a column. The policy is the plain one a player learns first: lock
 * the nearest, close in, swing, cast the best affordable spell, eat when hurt, and dodge a blow
 * as its telegraph runs out (the avatar is invulnerable for the last frames of a dodge). It is the
 * same for every build, so the numbers compare builds, not policies.
 */
export function fight(
  build: Build,
  tier: 1 | 2,
  rank: number,
  creature: string,
  seed: number,
  count = 1,
  start: FightStart = 'engaged',
  step?: 'a' | 'b' | 'c',
): FightResult {
  const all = CREATURES as Record<string, CreatureDef>;
  const real = all[creature] as CreatureDef;
  if (start !== 'engaged') {
    const rest: Record<string, unknown> = { ...real };
    delete rest.night;
    all[creature] = {
      ...(rest as unknown as CreatureDef),
      temperament: start,
      approach: real.approach ?? 40,
      fleeHpPct: real.fleeHpPct ?? 20,
    };
  }
  try {
    return fightOnce(build, tier, rank, creature, seed, count, start, step);
  } finally {
    all[creature] = real;
  }
}

function fightOnce(
  build: Build,
  tier: 1 | 2,
  rank: number,
  creature: string,
  seed: number,
  count: number,
  start: FightStart,
  step?: 'a' | 'b' | 'c',
): FightResult {
  return runScript({
    build,
    tier,
    rank,
    seed,
    start,
    encounters: [{ creature, count, ...(step ? { step } : {}) }],
  });
}

/** One thing to fight in a script: `count` of a creature, or a boss, at a zone step. */
export interface Encounter {
  creature: string;
  count: number;
  step?: 'a' | 'b' | 'c';
  /** A boss id (`creatures/bosses`): the fight uses its phases, and the boss is the one to bring down. */
  boss?: string;
  /** Before this encounter the avatar rests at a rest point: Health, Stamina and Focus back to full. */
  restBefore?: boolean;
}

/** What a script starts with. `bare` is the kit a new character wakes with. */
export interface ScriptOptions {
  build: Build;
  tier: 1 | 2;
  rank: number;
  seed: number;
  start: FightStart;
  encounters: Encounter[];
  /** `bare`: the wooden dagger, ragged clothes and one bread, and rank 0. Default `build`. */
  kit?: 'build' | 'bare';
  /** Pieces of bread carried (default 6). */
  food?: number;
  /** Armor worn over the build's own (the tier 1 gear a character has crafted). */
  armor?: string[];
}

/** A script's outcome: how far it got, and the cost. `ttk` is the seconds of the whole script. */
export interface ScriptResult extends FightResult {
  /** Encounters brought down. */
  won: number;
  /** Seconds each took, in order. */
  seconds: number[];
}

/**
 * Runs encounters one after another in one fight: Health, food and the avatar's place carry over,
 * and the next encounter begins once the last one is down. The single fight above is the one
 * encounter case.
 */
export function runScript(o: ScriptOptions): ScriptResult {
  const { build, tier, rank, seed, start, encounters } = o;
  let creature = encounters[0]!.creature;
  const s = createDemoState(seed, 0);
  // Time-to-kill targets are for clear weather. Weather has its own tests (M4-09).
  s.weatherOverride = 'clear';
  s.world = OPEN;
  const f = feetAt(30, 30);
  const me = createAvatar(s, f.x, f.y, 'Sim_1');
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds, worldTick: s.tick + 1 });
  };
  tick({ type: 'scheme', scheme: 'classic' });
  tick({ type: 'move', dir: E });
  tick({ type: 'move', dir: null });
  const bare = o.kit === 'bare';
  const spells = bare ? [] : dress(s, me, build, tier, rank);
  for (const piece of o.armor ?? []) {
    give(s, me, piece, 1, 'start');
    const inv = s.entities.comps.inventory[me]!;
    equip(
      s,
      me,
      inv.slots.findIndex((x) => x?.item === piece),
    );
  }
  if (o.armor) {
    recomputePools(s, me);
    const p = s.entities.comps.pools[me]!;
    p.hp = p.hpMax;
  }
  // The bare kit keeps the one bread a new character carries.
  if (!bare) give(s, me, FOOD, o.food ?? 6, 'start');
  const potion = bare ? undefined : build.potion?.[tier];
  if (potion) give(s, me, potion, 6, 'start');
  // The seed varies how the fight starts: how far the creatures stand (14 to 22 px) and how long
  // the player waits before the first swing (0 to 9 ticks), so a run is a spread, not one number.
  const j = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0;
  const gap = 14 + (j % 9);
  const wait = (j >>> 8) % 10;
  const here = (id: number): { x: number; y: number } => {
    const p = s.entities.comps.pos[id]!;
    return { x: p.x / 256, y: p.y / 256 };
  };
  let foes: number[] = [];
  let enc = 0;
  const seconds: number[] = [];
  let encStart = 0;
  /** Puts the next encounter's creatures a little way east of the avatar. */
  const spawnWave = (e: Encounter): void => {
    creature = e.creature;
    foes = [];
    // The first stands where it always has; later ones come at the avatar from where it is.
    const at = enc === 0 ? { x: 30 * 16 + 8, y: 30 * 16 + 14 } : here(me);
    for (let k = 0; k < e.count; k++) {
      const dy = (k - (e.count - 1) / 2) * 20;
      const x = Math.round(at.x) + gap + (k % 2) * 10;
      const y = Math.round(at.y) + dy;
      const id = e.boss ? spawnBoss(s, e.boss, x, y) : spawnCreature(s, e.creature, x, y, -1);
      if (e.step) applyStep(s, id, e.step);
      foes.push(id);
      // Engaged: already on the avatar, as the par numbers assume.
      const brain = s.entities.comps.ai[id];
      if (start === 'engaged' && brain) {
        brain.provoked = true;
        brain.target = me;
      }
    }
    encStart = s.tick;
  };
  spawnWave(encounters[0]!);
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
  // How far a spell can touch: a projectile's flight, or the reach of its shape around the avatar.
  const spellReach = (id: string): number => {
    const a = ATTACKS[TECHNIQUES[id]?.attack ?? ''];
    if (a?.projectile) return a.projectile.speed * a.projectile.ttl;
    const shape = a?.shape as { reach?: number } | undefined;
    return (shape?.reach ?? 24) + 16;
  };
  // Where a blow lands, and where a spell is cast from. A mage closes to the spell's distance
  // while a spell is ready and affordable, and to the blade's reach when it is not.
  const meleeEngage = (weapon?.family === 'archery' ? 90 : (weapon?.reach ?? 20)) * 0.85;
  const spellEngage = Math.min(90, Math.min(...spells.map(reachOf), 90) * 0.7);
  let ttk: number | null = null;
  let died = false;
  let eaten = 0;
  const max = MAX_SECONDS * TPS;
  const hostile = (): number[] =>
    query(s.entities, 'fighter', 'combatant', 'pos', 'ai').filter(
      (id) =>
        s.entities.alive[id] === true &&
        s.entities.comps.fighter[id]?.team === 1 &&
        s.entities.comps.fighter[id]?.state !== 'dead',
    );
  // An id can be reused by a drop once a creature is gone, so it must still be that creature.
  const alive = (id: number): boolean =>
    s.entities.alive[id] === true &&
    s.entities.comps.combatant[id]?.kind === creature &&
    s.entities.comps.fighter[id]?.state !== 'dead';
  for (let i = 0; i < max; i++) {
    const live = foes.filter(alive);
    if (live.length === 0) {
      seconds.push((s.tick - encStart) / TPS);
      enc++;
      if (enc >= encounters.length) {
        ttk = (s.tick - t0) / TPS;
        break;
      }
      const next = encounters[enc]!;
      if (next.restBefore) {
        pools.hp = pools.hpMax;
        pools.sta = pools.staMax;
        pools.foc = pools.focMax;
      }
      spawnWave(next);
      continue;
    }
    if (s.entities.comps.fighter[me]?.state === 'dead') {
      died = true;
      break;
    }
    const cmds: Command[] = [];
    const mp = here(me);
    // The nearest creature is the one fought: whatever hostile stands near, a boss's young too.
    const near = hostile();
    const targets = near.length > 0 ? near : live;
    let foe = targets[0] as number;
    let best = Infinity;
    for (const id of targets) {
      const p = here(id);
      const d = Math.hypot(p.x - mp.x, p.y - mp.y);
      if (d < best) {
        best = d;
        foe = id;
      }
    }
    const fp = here(foe);
    const dx = fp.x - mp.x;
    const dy = fp.y - mp.y;
    const dist = best;
    if (i % 15 === 0 || s.entities.comps.fighter[me]?.lock !== foe)
      cmds.push({ type: 'lock', x: Math.round(fp.x), y: Math.round(fp.y - 6) });
    // Drink a Focus potion when a spell is wanted and Focus has run out, as a mage does.
    if (
      potion &&
      i % 20 === 0 &&
      pools.foc < Math.min(...spells.map((id) => TECHNIQUES[id]?.cost?.amount ?? 0))
    ) {
      const slot = s.entities.comps.inventory[me]!.slots.findIndex((x) => x?.item === potion);
      if (slot >= 0) {
        cmds.push({ type: 'use', slot });
        eaten++;
      }
    }
    // Eat when hurt, the way a player does, from a pack of bread.
    if (pools.hp < 40 && i % 30 === 0) {
      const slot = s.entities.comps.inventory[me]!.slots.findIndex((x) => x?.item === FOOD);
      if (slot >= 0) {
        cmds.push({ type: 'use', slot });
        eaten++;
      }
    }
    const toward = dirToward(dx, dy);
    // Read the nearest creature's telegraph, as a player watches the one in front. The dodge
    // starts a little early or late: a player's reaction is not exact. The avatar is invulnerable
    // for the first frames of a dodge, so one begun inside the last 5 ticks of the wind-up avoids
    // the blow, and one begun earlier or after it does not.
    let dodge = false;
    {
      const fi = s.entities.comps.fighter[foe];
      const def = fi?.atk ? ATTACKS[fi.atk] : undefined;
      if (fi && fi.state === 'attack' && def && dist <= 130) {
        const left = def.windup - fi.t;
        const started = s.tick - fi.t;
        const noise = (Math.imul((seed * 31 + foe) ^ started, 2654435761) >>> 0) % 10;
        const threshold = 3 + noise - 4;
        if (left >= 0 && left <= threshold) dodge = true;
      }
    }
    if (dodge) {
      // Sideways to the line of the blow, so a charge goes past.
      cmds.push({ type: 'dodge', dir: ((toward + 2) % 8) as Direction });
    } else {
      const ready = spells.some((id) => {
        const t = TECHNIQUES[id]!;
        return (cd.get(id) ?? 0) <= s.tick && t.cost?.pool === 'foc' && pools.foc >= t.cost.amount;
      });
      const engage = build.kind === 'magic' && ready ? spellEngage : meleeEngage;
      cmds.push({ type: 'move', dir: dist > engage ? toward : null });
      // A spell is cast only when it is ready, affordable and can reach the creature.
      const cast = spells.find((id) => {
        const t = TECHNIQUES[id]!;
        return (
          (cd.get(id) ?? 0) <= s.tick &&
          t.cost?.pool === 'foc' &&
          pools.foc >= t.cost.amount &&
          dist <= spellReach(id)
        );
      });
      if (cast && dist <= engage + 20) {
        cmds.push({
          type: 'technique',
          slot: spells.indexOf(cast) + 1,
          phase: 'press',
          aim: toward,
        });
        cd.set(cast, s.tick + (TECHNIQUES[cast]!.cooldown ?? 0));
      } else if (dist <= meleeEngage + 14) {
        cmds.push({ type: 'attack' });
      }
    }
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
    won: enc,
    seconds,
  };
}

/** The food the policy carries: a pack of bread. */
const FOOD = 'item.dish_bread';

/** The nearest of the eight directions toward a vector. */
function dirToward(dx: number, dy: number): Direction {
  const a = Math.atan2(dx, -dy);
  return (((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8) as Direction;
}
