import type { StampV2 } from '../../../sim/world/stamp';
import { BUILT_DUNGEONS } from '../dungeons/registry';
import { INTERIORS } from '../interiors';
import { DAWNMEADOW_STAMPS } from './dawnmeadow';
import { HEARTHFORD } from './hearthford';
import { MOUTH_STAMPS } from './mouths';
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
    ...MOUTH_STAMPS,
    ...BUILT_DUNGEONS.flatMap((d) => d.stamps),
    ...INTERIORS.flatMap((i) => i.stamps),
  ].map((s) => [s.id, s]),
);
