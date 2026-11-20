import { MINIS } from './minis';
import { ROOTWAY_BUILT } from './rootway';
import { UNDERMILL_BUILT } from './undermill';

/** Every dungeon built with `defineDungeon`, in Dawnmeadow: the Rootway, then the mini-dungeons. */
export const BUILT_DUNGEONS = [ROOTWAY_BUILT, UNDERMILL_BUILT, ...MINIS] as const;
