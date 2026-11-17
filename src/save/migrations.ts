import { TIME } from '../content/balance/time';
import { intact } from './integrity/reasons';
import { newLedger } from '../sim/ledger';
import { xpToNext } from '../sim/skills';
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
  /**
   * 2 to 3 (M2-01): the sim gains a `ledger` of lifetime totals, and the save carries a copy. A
   * save made before the ledger has no history, so the ledger starts from what the avatar holds
   * under the source `seed`: coin as earned, items as made, and the XP that its skill points and
   * banked XP add up to. That reconciles by construction, so honest saves are not flagged.
   */
  2: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: Record<string, unknown[]> };
    };
    const comps = raw.entities.comps;
    const who = (comps.avatar ?? []).findIndex((a) => a);
    const ledger = newLedger();
    if (who >= 0) {
      const avatar = comps.avatar?.[who] as { coin: number };
      if (avatar.coin > 0) ledger.coinEarned.seed = avatar.coin;
      const inv = comps.inventory?.[who] as
        | {
            slots: ({ item: string; qty: number } | null)[];
            equipment: Record<string, string | null>;
          }
        | undefined;
      const seeded: Record<string, number> = {};
      for (const st of inv?.slots ?? []) if (st) seeded[st.item] = (seeded[st.item] ?? 0) + st.qty;
      for (const item of Object.values(inv?.equipment ?? {}))
        if (item) seeded[item] = (seeded[item] ?? 0) + 1;
      if (Object.keys(seeded).length > 0) ledger.itemsMade.seed = seeded;
      const sk = comps.skills?.[who] as
        { points: Record<string, number>; xp: Record<string, number> } | undefined;
      for (const id of new Set([...Object.keys(sk?.points ?? {}), ...Object.keys(sk?.xp ?? {})])) {
        let total = sk?.xp[id] ?? 0;
        for (let i = 0; i < (sk?.points[id] ?? 0); i++) total += xpToNext(i);
        if (total > 0) ledger.xpEarned[id] = total;
      }
    }
    const state = deserializeState(JSON.stringify({ ...raw, ledger }));
    return { ...old, schema: 3, sim: serializeState(state), ledger };
  },
  /**
   * 3 to 4 (M2-02): the save records when it was first written and whether it is Intact or
   * Flagged. A save from before has no record of its start, so it is taken to have started
   * `playSeconds` before it was last written, which is the earliest an honest save could have.
   * Every save starts Intact here; the validator runs on load and flags it if it is not.
   */
  3: (old) => ({
    ...old,
    schema: 4,
    startedAt: old.createdAt - old.playSeconds * 1000,
    trust: intact(),
  }),
  /**
   * 4 to 5 (M2-04): the save carries a trusted-time record. The world clock counts from an epoch,
   * and an old save's epoch is picked so the time of day at its last write is what it was under
   * the tick clock, then runs in real time from there. Its trusted time starts at its last write,
   * with no offset and no offline accrual used.
   */
  4: (old) => {
    const tickMs = Math.floor(
      ((JSON.parse(old.sim) as { tick: number }).tick * 60_000) / TIME.ticksPerMinute,
    );
    return {
      ...old,
      schema: 5,
      time: {
        epoch: old.createdAt - tickMs,
        lastTrustedNow: old.createdAt,
        offset: 0,
        accrualUsedMs: 0,
      },
    };
  },
  /**
   * 5 to 6 (M3-02): Cooking pays on the `craft` event instead of `cook`, so its first-time keys
   * `<skill>:cook:<recipe>` become `<skill>:craft:<recipe>` and no bonus is paid twice. Skills
   * gain a `nightAcc` counter (Survival), which starts at 0.
   */
  5: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { skills: ({ seen: string[]; nightAcc?: number } | null)[] } };
    };
    for (const sk of raw.entities.comps.skills) {
      if (!sk) continue;
      sk.seen = sk.seen.map((k) => k.replace(/^([^:]+):cook:/, '$1:craft:'));
      sk.nightAcc = 0;
    }
    return { ...old, schema: 6, sim: serializeState(deserializeState(JSON.stringify(raw))) };
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
