import { CREATURES } from '../../src/content/creatures';
import { ROSTERS } from '../../src/content/world/rosters';

/**
 * Time-to-kill targets at par, in seconds (design/04): common enemy 4 to 8, elite 20 to 40,
 * miniboss 60 to 90, regional boss 180 to 300. A creature's role is data here, so a new creature
 * is checked as soon as it is given one.
 */
export type Role = 'critter' | 'common' | 'elite' | 'miniboss' | 'boss';

export const BANDS: Record<Role, [number, number]> = {
  /** One-hit swarm and flock creatures (hare, sparrow, rat, wasp, wisp). Not in design/04: see the M4-05 PR. */
  critter: [1, 4],
  common: [4, 8],
  elite: [20, 40],
  miniboss: [60, 90],
  boss: [180, 300],
};

export const ROLES: Readonly<Record<string, Role>> = {
  'creature.mossling': 'common',
  'creature.spitbloom': 'common',
  'creature.bramble_boar': 'common',
  'creature.old_bramblehide': 'miniboss',
  'creature.thornling': 'common',
  'creature.fogcap': 'common',
  'creature.cinderback_boar': 'common',
  // Dawnmeadow's roster (M4-05). Every one is a common enemy at its zone's step.
  'creature.meadow_hare': 'critter',
  'creature.hedge_sparrow': 'critter',
  'creature.moor_wisp': 'critter',
  'creature.downs_ram': 'common',
  'creature.grain_rat': 'critter',
  'creature.fox': 'common',
  'creature.strawman': 'common',
  'creature.burrow_mole': 'common',
  'creature.thistle_wasp': 'critter',
  'creature.barrow_bones': 'common',
  'creature.reed_crab': 'common',
  'creature.marsh_leech': 'common',
  'creature.rubblet': 'common',
  'creature.crag_hawk': 'common',
  'creature.moorhound': 'common',
  'creature.thornling_scout': 'common',
  'creature.hollowhorn': 'miniboss',
};

/**
 * The step a creature is met at: the harshest of the zones it spawns in (a zone's roster names its
 * step in `content/world/rosters.ts`). Creatures with no zone are met at their data values.
 */
export const STEP_OF: Readonly<Record<string, 'a' | 'b' | 'c'>> = (() => {
  const rank = { a: 0, b: 1, c: 2 } as const;
  const out: Record<string, 'a' | 'b' | 'c'> = {};
  for (const r of Object.values(ROSTERS))
    if (r.step)
      for (const c of [...r.creatures, ...(r.night ?? [])]) {
        const had = out[c];
        if (!had || rank[r.step] > rank[had]) out[c] = r.step;
      }
  return out;
})();

/**
 * The tier of build a creature is checked against at par. A creature is met at its own tier, and
 * the cave miniboss is the gate out of the first map, so it is met by a character who has done
 * what the first map asks: rank 15 and tier 2 gear.
 */
export const PAR_TIER: Readonly<Record<string, 1 | 2>> = {
  'creature.old_bramblehide': 2,
};

/** The creatures the simulator fights: every one with a role, in the content's order. */
export const TARGETS: string[] = Object.keys(CREATURES).filter((id) => ROLES[id]);
