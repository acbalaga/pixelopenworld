/**
 * SCAFFOLDING. These lines are scripted so the slice has the feel of a busy online world in its
 * first minutes. They are not chat. The real chat (Travelers, channels, the log) arrives with M5
 * and replaces this file and `ui/dom/ambient.ts`'s ticker. Nothing else depends on it.
 */
export interface ScaffoldLine {
  /** Seconds of play (not wall time) at which the line appears. */
  atSec: number;
  name: string;
  text: string;
}

export const SCAFFOLD_CHAT: readonly ScaffoldLine[] = [
  { atSec: 25, name: 'Mira', text: 'morning all. did Brin restock the bread yet?' },
  {
    atSec: 70,
    name: 'Tobo',
    text: 'the dummy in the square has 2000 hp and has never lost a fight',
  },
  { atSec: 115, name: 'Halla', text: 'selling sunwort, 3 coin each, fresh this morning' },
  { atSec: 165, name: 'Mira', text: 'Orla is paying 50 coin to clear the mosslings. easy money' },
  { atSec: 215, name: 'Tobo', text: 'first Cooking rank. it was a burnt mess. i am so proud' },
  { atSec: 270, name: 'Wren', text: 'berries by the stream are the best in town, change my mind' },
  { atSec: 330, name: 'Halla', text: 'whoever keeps rolling past the request board, i see you' },
];
