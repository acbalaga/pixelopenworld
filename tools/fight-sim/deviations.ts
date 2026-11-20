/**
 * Time-to-kill deviations at par that are accepted, each with a reason (POW-M3-12). The key is
 * `<build id>|<creature id>`. An entry here means the number is out of its band on purpose.
 */
export const DEVIATIONS: Readonly<Record<string, string>> = {
  'stone|creature.fox':
    'Stone Fist is a point-blank burst on a fixed cadence, so a creature this small dies to the same number of casts whatever its Health within a few points (3.2 s, just under the band). A gap between builds, accepted (owner decision, see the report notes).',
  'stone|creature.marsh_leech':
    'Stone Fist is a point-blank burst on a fixed cadence, so a creature this small dies to the same number of casts whatever its Health within a few points (3.2 s, just under the band). A gap between builds, accepted (owner decision, see the report notes).',
  'stone|creature.crag_hawk':
    'Stone Fist is a point-blank burst on a fixed cadence, so a creature this small dies to the same number of casts whatever its Health within a few points (3.2 s, just under the band). A gap between builds, accepted (owner decision, see the report notes).',
  'unarmed|creature.hollowhorn':
    'Wraps give breath back on every hit, so an Unarmed fight is either a clean run or a long one (median 106 s, spread to 150 s), as it is against the cave miniboss.',
  'archery|creature.hollowhorn':
    'A bow stands off a field boss whose melee reach is short, so its damage is not interrupted (about 50 s against a 60 to 90 s band). Fighting from a distance is what the family is for.',
  'heavy|creature.hollowhorn':
    'The maul is the fastest melee family against Hollowhorn (about 55 s). A gap between builds, which is accepted (owner decision, see the report notes).',
  'archery|creature.old_bramblehide':
    'A bow stands off a boss whose reach is short, so its damage is not interrupted. Fighting from a distance is what the family is for.',
  'unarmed|creature.old_bramblehide':
    'Wraps give breath back on every hit, so an Unarmed fight is either a clean run (about 50 s) or a long one (over 100 s). The median sits under the band and the spread over it.',
  'archery|creature.burrow_mole':
    'A Burrow Mole dives between strikes and an arrow cannot reach a diving target, so a bow spends most of the fight waiting for it to surface. Melee and spells punish the surface window.',
  'tide|creature.reed_crab':
    'A guard lets go of a target past its tether, walks home and heals to full. Tide fights at range, so the crab keeps resetting (median over 60 s, spread to 160 s). Guards are meant to be fought up close. Follow-up: whether a kited guard should heal (PR for M4-05 part 3, design query).',
  'unarmed|creature.bramble_boar':
    'Wraps already sit at the top of the band against a Bramble Boar (8.6 s at step a). Boars in Hollow Downs are step b, which adds a tenth.',
};
