import type { ChatTemplate } from '../types';

/** The builder the full template set (POW-M5-15) shares: world channel, weight 3, 30 minute cooldown. */
export const T = (
  id: string,
  category: ChatTemplate['category'],
  trigger: ChatTemplate['trigger'],
  text: string[],
  extra: Partial<ChatTemplate> = {},
): ChatTemplate => ({
  id,
  category,
  channel: 'world',
  trigger,
  text,
  weight: 3,
  cooldownMin: 30,
  ...extra,
});

/** The same, said in Local: only a Traveler near the player can say it. */
export const L = (
  id: string,
  category: ChatTemplate['category'],
  trigger: ChatTemplate['trigger'],
  text: string[],
  extra: Partial<ChatTemplate> = {},
): ChatTemplate => T(id, category, trigger, text, { channel: 'local', ...extra });
