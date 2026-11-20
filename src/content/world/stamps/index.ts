import type { StampV2 } from '../../../sim/world/stamp';
import { ROOTWAY_STAMPS } from '../dungeons/rootway';
import { DAWNMEADOW_STAMPS } from './dawnmeadow';
import { HEARTHFORD } from './hearthford';
import { POI_STAMPS } from './pois';
import { SAMPLE_CELLAR, SAMPLE_HOUSE } from './sample';

/** Every v2 stamp the region baker can place, by id. */
export const STAMPS: Readonly<Record<string, StampV2>> = Object.fromEntries(
  [
    SAMPLE_HOUSE,
    SAMPLE_CELLAR,
    HEARTHFORD,
    ...DAWNMEADOW_STAMPS,
    ...POI_STAMPS,
    ...ROOTWAY_STAMPS,
  ].map((s) => [s.id, s]),
);
