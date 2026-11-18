import { PATHS_BALANCE as B } from '../balance/paths';

/**
 * Deeds (M3-08): counted things. A deed reads sim events and keeps a number (or a set of names).
 * Only the avatar's own manual doing counts: `by` names the event field that must be the avatar.
 */
export interface EventMatcher {
  /** The `SimEvent` type. */
  type: string;
  /** The field that holds who did it. It must be the avatar. */
  by: string;
  /** Other fields that must have exactly these values. */
  is?: Readonly<Record<string, string | number | boolean>>;
}

export interface DeedDef {
  id: string;
  /**
   * `count` adds one per match, `sum` adds the event's `field`, `distinct` records the event's
   * `field` once each, and `countSinceReset` counts like `count` until the `reset` event, which
   * zeroes it and notes when.
   */
  kind: 'count' | 'sum' | 'distinct' | 'countSinceReset';
  on: EventMatcher | readonly EventMatcher[];
  field?: string;
  reset?: EventMatcher;
}

const LIST: readonly DeedDef[] = [
  // One-handed kills: a killing blow with a blade or bare hands.
  {
    id: 'deed.kills_onehand',
    kind: 'count',
    on: [
      { type: 'killed', by: 'src', is: { tag: 'blades' } },
      { type: 'killed', by: 'src', is: { tag: 'unarmed' } },
    ],
  },
  // A fight won with nothing taken: sent by the deed system itself when a fight ends.
  { id: 'deed.untouched_fights', kind: 'count', on: { type: 'untouchedFight', by: 'who' } },
  { id: 'deed.parries', kind: 'count', on: { type: 'parried', by: 'who' } },
  {
    id: 'deed.ember_damage',
    kind: 'sum',
    on: { type: 'damageDealt', by: 'src', is: { tag: 'ember' } },
    field: 'amount',
  },
  {
    id: 'deed.wet_applied',
    kind: 'count',
    on: { type: 'statusApplied', by: 'src', is: { status: 'wet', self: false } },
  },
  { id: 'deed.forage', kind: 'count', on: { type: 'gathered', by: 'id', is: { tag: 'foraging' } } },
  { id: 'deed.ore', kind: 'count', on: { type: 'gathered', by: 'id', is: { tag: 'mining' } } },
  {
    id: 'deed.metal_crafted',
    kind: 'count',
    on: { type: 'crafted', by: 'id', is: { tag: 'smithing' } },
  },
  { id: 'deed.repairs', kind: 'count', on: { type: 'repaired', by: 'id' } },
  {
    id: 'deed.cloth_crafted',
    kind: 'count',
    on: { type: 'crafted', by: 'id', is: { tag: 'tailoring' } },
  },
  { id: 'deed.dishes', kind: 'count', on: { type: 'crafted', by: 'id', is: { tag: 'cooking' } } },
  {
    id: 'deed.dish_recipes',
    kind: 'distinct',
    on: { type: 'crafted', by: 'id', is: { tag: 'cooking' } },
    field: 'recipe',
  },
  { id: 'deed.raw_eaten', kind: 'count', on: { type: 'eaten', by: 'id', is: { raw: true } } },
  { id: 'deed.haggles_won', kind: 'count', on: { type: 'haggleWon', by: 'who' } },
  {
    id: 'deed.plain_sales',
    kind: 'count',
    on: { type: 'sold', by: 'who', is: { haggled: false } },
  },
  { id: 'deed.songs', kind: 'count', on: { type: 'perform', by: 'who' } },
  { id: 'deed.sneaks', kind: 'count', on: { type: 'sneak', by: 'who' } },
  {
    id: 'deed.mossling_meets',
    kind: 'countSinceReset',
    on: { type: 'met', by: 'who', is: { kind: 'creature.mossling' } },
    reset: { type: 'killed', by: 'src', is: { kind: 'creature.mossling' } },
  },
  {
    id: 'deed.mossling_kills',
    kind: 'count',
    on: { type: 'killed', by: 'src', is: { kind: 'creature.mossling' } },
  },
];

export const DEEDS: Readonly<Record<string, DeedDef>> = Object.fromEntries(
  LIST.map((d) => [d.id, d]),
);
export const DEED_LIST: readonly DeedDef[] = LIST;

/** Where a Mossling counts as met: it comes within this many px, and is "away" again past `leavePx`. */
export const MEET = { radiusPx: B.mossfriend.radiusPx, leavePx: B.mossfriend.leavePx };
