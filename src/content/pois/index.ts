import { DAWNMEADOW_POIS } from './dawnmeadow';
import type { PoiDef } from './types';

export type { PoiDef, PoiKind } from './types';
export { poiChest } from './dawnmeadow';

/** Every authored point of interest, by id. */
export const POIS: Readonly<Record<string, PoiDef>> = Object.fromEntries(
  DAWNMEADOW_POIS.map((p) => [p.id, p]),
);

export const poisOf = (region: string): readonly PoiDef[] =>
  Object.values(POIS).filter((p) => p.region === region);
