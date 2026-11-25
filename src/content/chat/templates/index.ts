import type { ChatTemplate } from '../types';
import { ECONOMY } from './economy';
import { DEEDS } from './deeds';
import { INDIVIDUALS } from './individuals';
import { EXCHANGES as BASE_EXCHANGES, KNOWLEDGE } from './knowledge';
import { PAIR_EXCHANGES } from './exchanges';
import { LFG } from './lfg';
import { QA } from './qa';
import { TALK } from './talk';
import { TRADE } from './trade';
import { WEATHER } from './weather';
import { REACTIONS } from './reactions';
import { SOCIAL } from './social';
import { CAMP } from './camp';

/**
 * Every chat template. About 120 for M5-05 to test the engine; POW-M5-15 grows the set to about 600. Files are by theme, ids by category.
 */
export const TEMPLATES: readonly ChatTemplate[] = [
  ...SOCIAL,
  ...ECONOMY,
  ...KNOWLEDGE,
  ...REACTIONS,
  ...TRADE,
  ...LFG,
  ...QA,
  ...WEATHER,
  ...TALK,
  ...DEEDS,
  ...INDIVIDUALS,
  ...CAMP,
];

/** Every exchange: the generic ones by tie kind and the pair-specific ones. */
export const EXCHANGES = [...BASE_EXCHANGES, ...PAIR_EXCHANGES];

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
