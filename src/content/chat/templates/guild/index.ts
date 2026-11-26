import { GUILD_LINES_A } from './a';
import { GUILD_LINES_B } from './b';
import { GUILD_LINES_C } from './c';
import type { GuildLine } from './types';

export type { GuildLine, GuildTrigger } from './types';

/** Every guild's chat lines (POW-M5-08). */
export const GUILD_LINES: readonly GuildLine[] = [
  ...GUILD_LINES_A,
  ...GUILD_LINES_B,
  ...GUILD_LINES_C,
];
