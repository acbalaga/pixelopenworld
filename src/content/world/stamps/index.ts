import type { StampV2 } from '../../../sim/world/stamp';
import { SAMPLE_CELLAR, SAMPLE_HOUSE } from './sample';

/** Every v2 stamp the region baker can place, by id. */
export const STAMPS: Readonly<Record<string, StampV2>> = Object.fromEntries(
  [SAMPLE_HOUSE, SAMPLE_CELLAR].map((s) => [s.id, s]),
);
