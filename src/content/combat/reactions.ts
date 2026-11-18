import { STATUS_BALANCE as B } from '../balance/status';
import type { ElementId, StatusId } from './statuses';

/**
 * Reactions (design/04). One row: an element `b` hits a unit that has status `a`. The row's
 * `removes` statuses go. Kept to four rows so the table stays learnable.
 */
export interface ReactionDef {
  id: 'steam' | 'chill' | 'shatter' | 'spread';
  a: StatusId;
  b: ElementId;
  result: string;
  removes: readonly StatusId[];
  /** A cloud or spread zone around the unit. `ticks` is set for a cloud that stays. */
  area?: { radius: number; ticks?: number };
  /** Burst damage dealt once to the unit. */
  damage?: number;
  /** Status the reaction leaves on the unit. */
  applies?: StatusId;
  /** Status the reaction spreads to every unit in the area. */
  spreads?: StatusId;
}

export const REACTIONS: readonly ReactionDef[] = [
  // Wet plus Ember: the water flashes to steam, a cloud that blocks sight and scalds lightly.
  {
    id: 'steam',
    a: 'wet',
    b: 'ember',
    result: 'steam',
    removes: ['wet'],
    area: { radius: B.steam.radius, ticks: B.steam.ticks },
    damage: B.steam.damage,
  },
  // Wet plus Gale: the wind chills it.
  { id: 'chill', a: 'wet', b: 'gale', result: 'chilled', removes: ['wet'], applies: 'chilled' },
  // Chilled plus Stone: a hard hit on frozen limbs.
  {
    id: 'shatter',
    a: 'chilled',
    b: 'stone',
    result: 'shatter',
    removes: ['chilled'],
    damage: B.shatterDamage,
  },
  // Burning plus Gale: the wind carries the flame to everyone near.
  {
    id: 'spread',
    a: 'burning',
    b: 'gale',
    result: 'spread',
    removes: [],
    area: { radius: B.spreadRadius },
    spreads: 'burning',
  },
];
