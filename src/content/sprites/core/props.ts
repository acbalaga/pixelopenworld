import type { SpriteDef } from '../types';

/** A rock. Object layer. */
export const propRock: SpriteDef = {
  id: 'prop.rock',
  group: 'core',
  size: [16, 16],
  origin: [8, 14],
  key: { '.': null, q: 16, r: 17, s: 18, t: 19 },
  frames: {
    base: [
      '................',
      '................',
      '................',
      '................',
      '.......ttt......',
      '....ttstsssss...',
      '...ttttssssrrr..',
      '...ttsssssrrrr..',
      '..ttssssrsrrrrq.',
      '..sssssrrrrrqqq.',
      '...ssrrrrrrqqq..',
      '...srrrrrqqqqq..',
      '....rrrrqqqqq...',
      '...qqqqqqqqqqq..',
      '................',
      '................',
    ],
  },
};
