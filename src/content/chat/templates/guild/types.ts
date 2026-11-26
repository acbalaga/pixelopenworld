/**
 * Guild chat (POW-M5-08). Each guild has its own lines in its own tone (design/12 section 7). A
 * line answers something real: a guildmate logged in or out, ranked up or looted, the player
 * joined or finished a weekly goal, or the guild is idling in the evening. Slots: `{player}` the
 * player's handle, `{handle}` the guildmate the line is about, `{skill}` a skill name, `{item}` an
 * item name. No line explains anything about the hidden layer.
 */
export type GuildTrigger =
  'idle' | 'hello' | 'bye' | 'welcome' | 'goal' | 'rank' | 'loot' | 'night';

export interface GuildLine {
  id: string;
  guild: number;
  trigger: GuildTrigger;
  text: readonly string[];
}

export const G =
  (guild: number) =>
  (id: string, trigger: GuildTrigger, ...text: string[]): GuildLine => ({
    id: `guild.${guild}.${id}`,
    guild,
    trigger,
    text,
  });
