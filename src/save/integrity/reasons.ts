/** Why a save was flagged. Stable ids: they are stored inside saves, so never rename one. */
export const REASON_CODES = [
  // Consistency: the save disagrees with itself or with the game's data.
  'MALFORMED_STATE',
  'SUMMARY_MISMATCH',
  'LEDGER_COPY_MISMATCH',
  'AVATAR_COUNT',
  'UNKNOWN_ID',
  'SKILL_UNKNOWN',
  'STATUS_UNKNOWN',
  'TECHNIQUE_UNKNOWN',
  'BAD_QUANTITY',
  'STACK_OVER_CAP',
  'DUR_RANGE',
  'QUALITY_ON_PLAIN',
  'AFFIX_OVERFLOW',
  'AFFIX_WITHOUT_ENCHANT',
  'PATH_UNEARNED',
  'WORN_NOT_EARNED',
  'DEED_EXCEEDS_LEDGER',
  'STACK_RULES',
  'MARK_WITHOUT_CRAFT',
  'MASTERWORK_WITHOUT_CRAFT',
  'BAG_SIZE',
  'EQUIP_SLOT',
  'POOL_MAX_MISMATCH',
  'POOL_OVER_MAX',
  'RANK_XP_MISMATCH',
  'TRIAL_PROGRESS_ORPHAN',
  'TRIAL_UNPASSED',
  'REQUEST_STATE',
  'RENOWN_RANGE',
  'TICK_PLAYTIME_MISMATCH',
  'MAP_STATE',
  'SINGULAR_STATE',
  // Ledger: what the avatar holds does not reconcile with what the sim recorded.
  'COIN_RECONCILE',
  'XP_EXCEEDS_EARNED',
  'ITEMS_EXCEED_MADE',
  'ITEM_SOURCE_LOCKED',
  'LOOT_WITHOUT_KILL',
  'REQUEST_PAYOUT_MISMATCH',
  'REQUEST_REWARD_UNMATCHED',
  'CRAFT_MISMATCH',
  'PURCHASE_MISMATCH',
  'BUYBACK_EXCEEDS_SOLD',
  'ECHO_EXCEEDS_DROPPED',
  'START_KIT_MISMATCH',
  'MANUAL_READ_UNSOURCED',
  'SINGULAR_REWARD_UNEARNED',
  // Plausibility: the totals are not possible in the recorded time.
  'COIN_IMPLAUSIBLE',
  'XP_IMPLAUSIBLE',
  'KILLS_IMPLAUSIBLE',
  'CRAFTS_IMPLAUSIBLE',
  'GATHER_RATE',
  'SALE_RATE',
  'PLAYTIME_EXCEEDS_ELAPSED',
  'TRAVELER_BUILD',
  'MAIL_IMPLAUSIBLE',
  'GUILD_IMPLAUSIBLE',
  'PIT_HONOR',
  'MARKET_INCOME',
  'EVENT_IMPLAUSIBLE',
  'HARVEST_IMPLAUSIBLE',
  'MILL_MISMATCH',
  'FISH_RECORD',
  'HOME_LAYOUT',
  // Snapshots.
  'CHAIN_BROKEN',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export type Layer = 'consistency' | 'ledger' | 'plausibility' | 'chain';

/** One failed rule. `detail` is for developers and logs, never shown as game text. */
export interface Reason {
  code: ReasonCode;
  layer: Layer;
  detail: string;
}

/** Trust states (tech/02). Flagged has no gameplay effect, is permanent, and travels with exports. */
export interface Trust {
  state: 'intact' | 'flagged';
  /** Every code that ever flagged this save, in the order first seen. */
  reasons: ReasonCode[];
  /** Wall clock ms of the first flag, or null while Intact. */
  flaggedAt: number | null;
}

/** A save with no problems found. */
export function intact(): Trust {
  return { state: 'intact', reasons: [], flaggedAt: null };
}

/**
 * Folds a verdict into the trust a save already carries. Flagged never goes back to Intact, and
 * new reasons are added to the old ones.
 */
export function mergeTrust(prev: Trust | undefined, found: readonly Reason[], now: number): Trust {
  const base: Trust = prev ? { ...prev, reasons: [...prev.reasons] } : intact();
  for (const r of found) if (!base.reasons.includes(r.code)) base.reasons.push(r.code);
  if (base.state === 'intact' && found.length > 0) {
    base.state = 'flagged';
    base.flaggedAt = now;
  }
  return base;
}
