import { PIT } from '../balance/travelers';
import type { Rumor } from './types';

/**
 * The trail to the Pit (POW-M5-29). Three true rumors, each more specific, told in order: the
 * second only once the player has heard the first and been to the quarry, the third only once they
 * have heard the second. They point at the quarry and nothing else: never a town, never anything
 * underground, and nothing about the hidden layer (design/08 delivery rules).
 */
export const PIT_RUMORS: readonly Rumor[] = [
  {
    id: 'rumor.pit_1',
    about: 'place',
    text: 'something goes on in the old cut past the quarry crane once it is dark. nobody will say what',
    true: true,
    gate: { needs: [], sets: PIT.flags.rumor1 },
  },
  {
    id: 'rumor.pit_2',
    about: 'place',
    text: 'they light braziers in the old cut past the crane after dark, and someone keeps stacking crates round the back of it',
    true: true,
    gate: { needs: [PIT.flags.rumor1, PIT.flags.quarry], sets: PIT.flags.rumor2 },
  },
  {
    id: 'rumor.pit_3',
    about: 'place',
    text: 'those crates behind the crane are not stuck. push them from the quarry side and they slide. there is a ring back there, big enough to fight in',
    true: true,
    gate: { needs: [PIT.flags.rumor2], sets: PIT.flags.rumor3 },
  },
];
