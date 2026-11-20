import { OLD_BRAMBLEHIDE_BOSS } from './rootway';
import { MILLRACE_EEL_BOSS } from './undermill';
import { SAMPLE_BOSS } from './sample';
import type { BossDef } from './types';

/** Every boss by id. */
export const BOSSES: Readonly<Record<string, BossDef>> = Object.fromEntries(
  [SAMPLE_BOSS, OLD_BRAMBLEHIDE_BOSS, MILLRACE_EEL_BOSS].map((b) => [b.id, b]),
);
