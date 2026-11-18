import type { RegionSpec } from './types';
import { SAMPLE_REGION } from './sample/spec';

/** Every region spec the baker bakes, by id. The sample is a fixture for the baker's tests. */
export const REGION_SPECS: Readonly<Record<string, RegionSpec>> = Object.fromEntries(
  [SAMPLE_REGION].map((r) => [r.id, r]),
);
