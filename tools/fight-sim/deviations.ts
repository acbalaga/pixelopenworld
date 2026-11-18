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
};
