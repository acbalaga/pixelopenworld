/**
 * Points of interest (POW-M4-11, regions/01-dawnmeadow section 12). A POI is a small authored
 * thing worth walking to: a shrine, a vista, a wreck, a hermit, a puzzle or an oddity. It is data.
 * The region spec places what it holds, the pacing ledger counts it, and the bake check counts it
 * as a discoverable for the chunk it stands in.
 */
export type PoiKind = 'shrine' | 'vista' | 'wreck' | 'hermit' | 'puzzle' | 'oddity';

export interface PoiDef {
  /** `poi.<name>`. */
  id: string;
  kind: PoiKind;
  region: string;
  /** Region tiles. */
  x: number;
  y: number;
  /** Planning minutes for the pacing ledger (regions/01 section 14: about 4). */
  estMinutes: number;
  /**
   * A manual in a chest at this spot (M4-15). The chest is `fixture.chest_<manual>`, so the
   * manual is a second source of its technique that can be found without a teacher.
   */
  manual?: string;
}
