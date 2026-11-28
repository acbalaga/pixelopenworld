import { FARMING as F } from '../content/balance/farming';
import type { CropFamily } from '../content/farming/crops';

/**
 * The saved shape of the field (POW-M6-02). Kept apart from `farming.ts` so the state module can
 * build and load it without pulling in the farming rules.
 */

/** One plot of the reeve's field. Saved. */
export interface Plot {
  tilled: boolean;
  /** The crop in the ground, or null for an empty plot. */
  crop: string | null;
  /** World tick it was planted. */
  planted: number;
  /** Growth units settled so far, and the world tick they are settled up to. */
  growth: number;
  at: number;
  /** World tick of the last watering (-1 for never), and how many ticks it lasts. */
  watered: number;
  wetFor: number;
  /** Soil quality 0 to 3. */
  soil: number;
  /** Fertilizer on the growing crop: it grows `fertBoost` faster until harvested. */
  fert: boolean;
  /** Harvests taken from the crop now in the ground (a regrowing crop fruits more than once). */
  cuts: number;
  /** The lease runs to this world tick. Growth pauses past it. */
  paidUntil: number;
  /** Family of the last crop harvested here, for rotation. */
  family: CropFamily | null;
  /** World tick the plot last became tilled and empty (for fallow days), or -1. */
  emptySince: number;
  /** The four plants of a square that merged into a giant (13 section 2.2): the square's index. */
  giant?: number;
  /** The giant check has run for the crop now in the ground. */
  rolled?: true;
}

/** The field, what the player has learned to grow, and the water in the can. Saved. */
export interface FarmState {
  plots: Plot[];
  /** Crops whose seed the player knows (planted once, or found in a pod). */
  known: string[];
  /** Waterings left in the can. */
  water: number;
}

export function newPlot(): Plot {
  return {
    tilled: false,
    crop: null,
    planted: 0,
    growth: 0,
    at: 0,
    watered: -1,
    wetFor: 0,
    soil: F.soilStart,
    fert: false,
    cuts: 0,
    paidUntil: 0,
    family: null,
    emptySince: -1,
  };
}

export function newFarm(): FarmState {
  return { plots: Array.from({ length: F.plots }, newPlot), known: [], water: F.canCharges };
}

/** A loaded field, or a new one if the save has none. Every plot the field has is present. */
export function normalFarm(raw: FarmState | undefined): FarmState {
  if (!raw || !Array.isArray(raw.plots)) return newFarm();
  const plots = Array.from({ length: F.plots }, (_, i) => ({ ...newPlot(), ...raw.plots[i] }));
  return {
    plots,
    known: Array.isArray(raw.known) ? raw.known : [],
    water: typeof raw.water === 'number' ? raw.water : F.canCharges,
  };
}
