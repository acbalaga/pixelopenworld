import { ROOTWAY } from './rootway';
import { SAMPLE_DUNGEON } from './sample';
import type { DungeonDef } from './types';

/** Every dungeon by id. The sample is the validator's passing case and the template for real ones. */
export const DUNGEONS: Readonly<Record<string, DungeonDef>> = Object.fromEntries(
  [SAMPLE_DUNGEON, ROOTWAY].map((d) => [d.id, d]),
);

/** Dungeon room ids by `<dungeon>.<room>`, for the Delving XP rule. */
export function dungeonOfRoom(roomId: string): string | null {
  for (const d of Object.values(DUNGEONS))
    for (const r of d.rooms) if (`${d.id}.${r.id}` === roomId) return d.id;
  return null;
}
