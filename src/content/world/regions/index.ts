import type { RegionSpec } from './types';
import { SAMPLE_REGION } from './sample/spec';
import { DAWNMEADOW } from './dawnmeadow/spec';
import { DEV_STRESS_REGION } from './dev-stress/spec';

/** Every region spec the baker bakes, by id. The sample is a fixture for the baker's tests. */
export const REGION_SPECS: Readonly<Record<string, RegionSpec>> = Object.fromEntries(
  [SAMPLE_REGION, DEV_STRESS_REGION, DAWNMEADOW].map((r) => [r.id, r]),
);
