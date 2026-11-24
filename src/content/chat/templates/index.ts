import type { ChatTemplate } from '../types';
import { ECONOMY } from './economy';
import { EXCHANGES, KNOWLEDGE } from './knowledge';
import { REACTIONS } from './reactions';
import { SOCIAL } from './social';

/**
 * Every chat template. About 120 for M5-05, enough to test the engine; POW-M5-15 grows the set to
 * about 600. Files are by theme, ids by category.
 */
export const TEMPLATES: readonly ChatTemplate[] = [
  ...SOCIAL,
  ...ECONOMY,
  ...KNOWLEDGE,
  ...REACTIONS,
];
export { EXCHANGES };

/** Templates by trigger, for the engine. */
export const BY_TRIGGER: ReadonlyMap<string, readonly ChatTemplate[]> = (() => {
  const m = new Map<string, ChatTemplate[]>();
  for (const t of TEMPLATES) {
    const list = m.get(t.trigger) ?? [];
    list.push(t);
    m.set(t.trigger, list);
  }
  return m;
})();
