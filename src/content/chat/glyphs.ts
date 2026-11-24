import type { Glyph } from './types';

/**
 * The twelve pixel glyphs of chat (D26): 8 x 8, drawn from data, shown inline in clear text at
 * the line's height with their name as `alt`. No OS emoji ever appears in generated chat. `.` is
 * clear, `#` the ink, `o` the dark outline.
 */
export const GLYPHS: readonly Glyph[] = [
  {
    id: 'heart',
    ink: 22,
    rows: [
      '........',
      '.oo.oo..',
      'o##o##o.',
      'o#####o.',
      '.o###o..',
      '..o#o...',
      '...o....',
      '........',
    ],
  },
  {
    id: 'coin',
    ink: 47,
    rows: [
      '..oooo..',
      '.o####o.',
      'o##oo##o',
      'o#o##o#o',
      'o#o##o#o',
      'o##oo##o',
      '.o####o.',
      '..oooo..',
    ],
  },
  {
    id: 'sword',
    ink: 3,
    rows: [
      '......oo',
      '.....o#o',
      '....o#o.',
      'o..o#o..',
      '.o#o#o..',
      '..o##o..',
      '.o#oo...',
      'o#o.....',
    ],
  },
  {
    id: 'shield',
    ink: 14,
    rows: [
      '.oooooo.',
      'o######o',
      'o#o##o#o',
      'o#o##o#o',
      'o######o',
      '.o####o.',
      '..o##o..',
      '...oo...',
    ],
  },
  {
    id: 'skull',
    ink: 3,
    rows: [
      '.oooooo.',
      'o######o',
      'o#o##o#o',
      'o#o##o#o',
      'o######o',
      '.o#oo#o.',
      '.o#oo#o.',
      '..oooo..',
    ],
  },
  {
    id: 'star',
    ink: 47,
    rows: [
      '...oo...',
      '...o#o..',
      'ooo#ooo.',
      'o#####o.',
      '.o###o..',
      '.o#o#o..',
      'o#o.o#o.',
      '.o...o..',
    ],
  },
  {
    id: 'sparkle',
    ink: 3,
    rows: [
      '...o....',
      '..o#o...',
      '...o..o.',
      'o#o#o#o.',
      '...o..o.',
      '..o#o...',
      '...o....',
      '........',
    ],
  },
  {
    id: 'fish',
    ink: 12,
    rows: [
      '........',
      '..oooo.o',
      '.o####oo',
      'o#o###o#',
      'o#####o#',
      '.o####oo',
      '..oooo.o',
      '........',
    ],
  },
  {
    id: 'music',
    ink: 3,
    rows: [
      '...ooooo',
      '...o###o',
      '...o#oo#',
      '...o#...',
      '...o#...',
      '.ooo#...',
      'o###o...',
      '.ooo....',
    ],
  },
  {
    id: 'zzz',
    ink: 12,
    rows: [
      '.oooooo.',
      '.o####o.',
      '.oooo#o.',
      '....o#o.',
      '...o#o.o',
      '..o#oo##',
      '..oooo#o',
      '.....ooo',
    ],
  },
  {
    id: 'laugh',
    ink: 47,
    rows: [
      '..oooo..',
      '.o####o.',
      'o#o##o#o',
      'o######o',
      'o#oooo#o',
      'o#o##o#o',
      '.o####o.',
      '..oooo..',
    ],
  },
  {
    id: 'sweat',
    ink: 12,
    rows: [
      '..oooo.o',
      '.o####o#',
      'o#o##o#o',
      'o######o',
      'o#.oo.#o',
      'o#o##o#o',
      '.o####o.',
      '..oooo..',
    ],
  },
];

export const GLYPH_IDS: readonly string[] = GLYPHS.map((g) => g.id);
