/**
 * The integrity validator (tech/02). Pure functions over a `SavePlain`. Three layers, run on
 * every load and every import, and on every save in dev builds:
 *
 *  1. consistency: the save agrees with itself and with the game's data (summary, ids, caps,
 *     pools, rank and XP).
 *  2. ledger: what the avatar holds reconciles with what the sim recorded as it happened.
 *  3. plausibility: totals are possible in the recorded play time.
 *
 * A failed rule gives a reason code. The save is then Flagged, permanently, with no effect on
 * play (decision A7). A legitimate player must never be flagged: bounds are generous and come
 * from content where they can (see `bounds.ts`), and `tests/sim/recordedSessions.test.ts`
 * replays scripted runs and requires zero flags.
 *
 * ## When you add a system that creates value
 *
 * Money, XP, items, kills or crafts must not appear without a record. In the same ticket:
 *
 *  - Report it to the ledger (`src/sim/ledger.ts`): `earnCoin` / `spendCoin` for coin,
 *    `madeItems` (or `give(..., source)`) for items, `earnedXp` through `addXp`, `recordKill`,
 *    `recordCraft`. Add a source name to `CoinSource` or `ItemSource` if it is a new one.
 *  - Teach this module the source: `sources.ts` lists where each item can come from, derived
 *    from content, so a new item table usually needs no code. `consistency.ts` lists the
 *    allowed source names. If the source has a natural ceiling (a fixed reward, a rate), add a
 *    rule in `ledgerRules.ts` (exact reconciliation) or `plausibility.ts` (a ceiling from
 *    `bounds.ts`, derived from `content/balance/`).
 *  - Add a unit test per rule, just inside the bound (passes) and just outside (flags with the
 *    right code), and extend the recorded-session bots so honest play of the new system stays
 *    at zero flags.
 *  - Changing what is saved needs a schema bump and a migration (`src/save/README.md`).
 */
import { buildView } from './view';
import { consistency } from './consistency';
import { ledgerRules } from './ledgerRules';
import { plausibility } from './plausibility';
import type { Reason } from './reasons';
import type { SavePlain } from '../types';

export * from './reasons';

/** What the validator found. `ok` is true when no rule failed. */
export interface IntegrityResult {
  ok: boolean;
  reasons: Reason[];
}

/** Extra facts from loading, not stored in the save itself. */
export interface IntegrityContext {
  /** The snapshot chain check from the loader. `broken` flags the save. */
  chain?: 'ok' | 'broken' | 'unchecked';
}

/** Runs every layer. Never throws: a save that cannot be read as a save is MALFORMED_STATE. */
export function validateSave(plain: SavePlain, ctx: IntegrityContext = {}): IntegrityResult {
  const reasons: Reason[] = [];
  if (ctx.chain === 'broken')
    reasons.push({ code: 'CHAIN_BROKEN', layer: 'chain', detail: 'snapshot hash chain is broken' });
  try {
    const view = buildView(plain);
    reasons.push(...consistency(view), ...ledgerRules(view), ...plausibility(view));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    reasons.push({
      code: message.startsWith('AVATAR_COUNT') ? 'AVATAR_COUNT' : 'MALFORMED_STATE',
      layer: 'consistency',
      detail: message,
    });
  }
  return { ok: reasons.length === 0, reasons };
}
