import { T } from '../items/define';

/**
 * Cooking in full (POW-M6-04, design/05 Cooking). The numbers every new dish, the oven, the mill
 * and the camp meal read. A dish's restore and Fed buff come from its tier and what it is for
 * (`hp` hearty, `sta` filling, `foc` bright, `all` a feast), so a new dish needs no numbers of
 * its own. Health in points, Stamina and Focus in tenths, as in `food.ts`.
 */
export const COOKING = {
  /** Restore and Fed buff by tier (1 to 4): the main pool, and the share the others get. */
  byTier: {
    1: { main: 14, pool: 180, fedMin: 3, max: 10, value: 12 },
    2: { main: 26, pool: 260, fedMin: 4, max: 20, value: 24 },
    3: { main: 40, pool: 340, fedMin: 6, max: 30, value: 42 },
    4: { main: 58, pool: 420, fedMin: 8, max: 45, value: 70 },
  } as Readonly<
    Record<number, { main: number; pool: number; fedMin: number; max: number; value: number }>
  >,
  /** Ticks in a minute, for the Fed length. */
  ticksPerMinute: T,
  /** The share of the main amounts the other pools get, in percent. A feast gets this on all three. */
  sidePct: 35,
  feastPct: 75,
  /** Aldo mills wheat to flour: this many wheat make one flour, for this fee. */
  mill: { wheat: 2, fee: 3 },
  /** A camp meal feeds every party member within this many px of the cook. */
  campPx: 96,
} as const;
