/**
 * Time-to-kill deviations at par that are accepted, each with a reason (POW-M3-12). The key is
 * `<build id>|<creature id>`. An entry here means the number is out of its band on purpose.
 */
const REASON =
  'The policy swings and dodges on a fixed beat and does not read telegraphs, so it falls before it can win. A miniboss is beaten by reading its attacks (design/04), so its time to kill waits for a telegraph-reading bot (M12-03).';

export const DEVIATIONS: Readonly<Record<string, string>> = {
  'blades|creature.old_bramblehide': REASON,
  'polearms|creature.old_bramblehide': REASON,
  'archery|creature.old_bramblehide': REASON,
  'unarmed|creature.old_bramblehide': REASON,
  'ember|creature.old_bramblehide': REASON,
  'tide|creature.old_bramblehide': REASON,
  'stone|creature.old_bramblehide': REASON,
};
