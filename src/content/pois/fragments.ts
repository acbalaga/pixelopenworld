/**
 * Lore fragment slots (POW-M4-11, regions/01-dawnmeadow section 13): eighteen empty markers, DM-F01
 * to DM-F18. Their content arrives in M10; until then a marker is a point in the data and nothing
 * on screen. Nothing here names or explains anything (design/08 "Delivery rules"). A slot is in the
 * open world at `at`, or in a dungeon room (a slot may be `pending` until its place is built).
 */
export interface FragmentSlot {
  /** `dm_f01`. The marker kind is `marker.fragment.<id>`. */
  id: string;
  /** Region tile, for a slot out in the open. */
  at?: { x: number; y: number };
  /** The dungeon whose rooms hold it, by dungeon id. */
  dungeon?: string;
  /** Not placed yet: the place that holds it is a later part of the ticket. This list only shrinks. */
  pending?: true;
}

const open = (id: string, x: number, y: number): FragmentSlot => ({ id, at: { x, y } });
const inside = (id: string, dungeon: string): FragmentSlot => ({ id, dungeon });

export const FRAGMENT_SLOTS: readonly FragmentSlot[] = [
  open('dm_f01', 170, 185), // Wren's study
  open('dm_f02', 186, 177), // the bell tower
  open('dm_f03', 199, 197), // the Pilgrim's bench
  open('dm_f04', 283, 113), // the mill loft
  inside('dm_f05', 'dungeon.m5'), // the chapel crypt
  inside('dm_f06', 'dungeon.m10'), // the Shepherd's Barrow
  inside('dm_f07', 'dungeon.rootway'), // Rootway R9
  inside('dm_f08', 'dungeon.undermill'), // the Undermill cistern
  inside('dm_f09', 'dungeon.deeps'), // Stonecrop Deeps, the sealed vein
  inside('dm_f10', 'dungeon.thornwall'), // the Thornwall keep, upper room
  open('dm_f11', 150, 266), // the stone circle
  open('dm_f12', 46, 50), // the Cairnmoor ring
  inside('dm_f13', 'dungeon.m9'), // Hermit's Well, the bottom
  open('dm_f14', 203, 239), // the sundial
  open('dm_f15', 60, 38), // the lit window sightline
  open('dm_f16', 309, 264), // the beached boat
  open('dm_f17', 142, 128), // the hedge maze centre
  open('dm_f18', 279, 47), // the Lark spring grotto
];

export const fragmentMarker = (id: string): string => `marker.fragment.${id}`;
