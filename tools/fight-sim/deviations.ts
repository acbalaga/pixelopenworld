/**
 * Time-to-kill deviations at par that are accepted, each with a reason (POW-M3-12). The key is
 * `<build id>|<creature id>`. An entry here means the number is out of its band on purpose.
 */
export const DEVIATIONS: Readonly<Record<string, string>> = {
  'stone|creature.spitbloom':
    'Stone Fist is a point-blank burst that lands on every cast against a rooted target, so it kills a Spitbloom sooner than it kills anything that moves. That is the school doing its job.',
  'archery|creature.old_bramblehide':
    'A bow stands off a boss whose reach is short, so its damage is not interrupted. Fighting from a distance is what the family is for.',
  'unarmed|creature.old_bramblehide':
    'Wraps give breath back on every hit, so an Unarmed fight is either a clean run (about 50 s) or a long one (over 100 s). The median sits under the band and the spread over it.',
  // Dawnmeadow (M4-05).
  'stone|creature.fox':
    'Stone Fist is a point-blank burst, so a small, light creature goes down in a cast or two. That is the school doing its job.',
  'stone|creature.marsh_leech':
    'Stone Fist is a point-blank burst, so a small, light creature goes down in a cast or two. That is the school doing its job.',
  'stone|creature.crag_hawk':
    'Stone Fist is a point-blank burst, and a hawk comes in close to dive, so it is hit squarely. That is the school doing its job.',
  'archery|creature.burrow_mole':
    'A mole is unhurtable while it tunnels and rises beside its target, so arrows spent while it is under are lost and the fight runs long. That is what a burrower is for.',
  'tide|creature.reed_crab':
    'Splash is soft against a defense 8 shell, so Tide takes the long way round a crab. Another school does it better, and that is the point of a guard.',
  'archery|creature.hollowhorn':
    'A bow stands off a boss that must cross the ground to reach it, so its damage is not interrupted. Fighting from a distance is what the family is for.',
  'ember|creature.hollowhorn':
    'A caster spends Focus on every cast, and a fight this long runs it dry, so the rest is slow strikes and waiting. A field boss is where a school without sustain feels it.',
  'stone|creature.hollowhorn':
    'A caster spends Focus on every cast, and a fight this long runs it dry, so the rest is slow strikes and waiting. A field boss is where a school without sustain feels it.',
};
