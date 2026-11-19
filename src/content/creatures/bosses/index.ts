import { SAMPLE_BOSS } from './sample';
import type { BossDef } from './types';

/** Every boss by id. */
export const BOSSES: Readonly<Record<string, BossDef>> = Object.fromEntries(
  [SAMPLE_BOSS].map((b) => [b.id, b]),
);
