import { deserializeState, serializeState } from '../sim/state';
import { CURRENT_SCHEMA, type SavePlain } from './types';

/**
 * Migrations, keyed by the schema they upgrade FROM. Each takes a save at schema N and returns
 * one at schema N + 1. They run in order until the save is current. Schema 1 is the first, so the
 * table started empty.
 *
 * To change saved state: bump CURRENT_SCHEMA, add `MIGRATIONS[oldSchema]`, commit a fixture of the
 * old schema under `tests/fixtures/saves/`, and extend `tests/unit/save.test.ts` with a case that
 * loads it. See `src/save/README.md`.
 */
export const MIGRATIONS: Record<number, (old: SavePlain) => SavePlain> = {
  /**
   * 1 to 2 (M1-10): the avatar gains a `handle`, and the journal gains `hints` and `hint`. An old
   * save keeps playing under the name "Traveler" with no hint ever shown, since it is not new.
   */
  1: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { avatar: unknown[]; journal: unknown[] } };
    };
    const patch = (list: unknown[], add: Record<string, unknown>): void => {
      list.forEach((c) => {
        if (c && typeof c === 'object') Object.assign(c, add);
      });
    };
    patch(raw.entities.comps.avatar, { handle: 'Traveler' });
    patch(raw.entities.comps.journal, { hints: HINT_IDS_V1, hint: null });
    return { ...old, schema: 2, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
};

/** Every hint that existed in schema 2, marked as seen for a save made before hints existed. */
const HINT_IDS_V1: string[] = [
  'hint.move',
  'hint.lock',
  'hint.dodge',
  'hint.technique',
  'hint.gather',
  'hint.cook',
  'hint.menu',
];

/** Brings a save up to the current schema. Throws for a save from the future or a missing step. */
export function migrate(
  plain: SavePlain,
  table: Record<number, (old: SavePlain) => SavePlain> = MIGRATIONS,
  target: number = CURRENT_SCHEMA,
): SavePlain {
  if (plain.schema > target) throw new Error(`save schema ${plain.schema} is newer than ${target}`);
  let cur = plain;
  while (cur.schema < target) {
    const step = table[cur.schema];
    if (!step) throw new Error(`no migration from schema ${cur.schema}`);
    const next = step(cur);
    if (next.schema !== cur.schema + 1)
      throw new Error(`migration from ${cur.schema} produced schema ${next.schema}`);
    cur = next;
  }
  return cur;
}
