import { MINIS } from './minis';
import { ROOTWAY_BUILT } from './rootway';

/** Every dungeon built with `defineDungeon`, in Dawnmeadow: the Rootway, then the mini-dungeons. */
export const BUILT_DUNGEONS = [ROOTWAY_BUILT, ...MINIS] as const;
