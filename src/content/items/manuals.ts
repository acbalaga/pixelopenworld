import type { ItemDef } from './types';
import { item } from './define';

/**
 * Manuals (M4-15, design/11 Sources): a book, scroll or carving that teaches one technique when
 * read. Reading uses it up. The skill awakens if it was dormant. Each is the second source of a
 * technique, found in a chest. Copies can exist, so losing or selling one is not a loss.
 */
export const MANUALS: readonly { id: string; technique: string; skill: string }[] = [
  { id: 'item.manual_lunge', technique: 'technique.blades_lunge', skill: 'skill.blades' },
  { id: 'item.manual_palm', technique: 'technique.unarmed_palm', skill: 'skill.unarmed' },
  {
    id: 'item.manual_light_feet',
    technique: 'technique.evasion_light_feet',
    skill: 'skill.evasion',
  },
  { id: 'item.manual_kindling', technique: 'technique.ember_bolt', skill: 'skill.ember' },
  { id: 'item.manual_splash', technique: 'technique.tide_splash', skill: 'skill.tide' },
  { id: 'item.manual_gust', technique: 'technique.gale_gust', skill: 'skill.gale' },
  { id: 'item.manual_stone_fist', technique: 'technique.stone_fist', skill: 'skill.stone' },
  { id: 'item.manual_mend', technique: 'technique.mending_mend', skill: 'skill.mending' },
  {
    id: 'item.manual_road_songs',
    technique: 'technique.performance_hum',
    skill: 'skill.performance',
  },
  { id: 'item.manual_hide', technique: 'technique.stealth_hide', skill: 'skill.stealth' },
];

export const MANUAL_ITEMS: readonly ItemDef[] = MANUALS.map((m) =>
  item(m.id, 'misc', {
    value: 0,
    stack: 5,
    manual: { technique: m.technique, skill: m.skill },
    icon: 'icon.scroll_recipe',
  }),
);
