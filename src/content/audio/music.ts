import type { TrackDef } from './types';

// Rows are eighth notes. 16 rows = 2 bars of 4/4. A minor pentatonic leads over Am F C G.
// Percussion notes pick the noise band: C3 low thump, C7 hat.
export const THEME_TRACK: TrackDef = {
  id: 'music.theme',
  bpm: 108,
  rowsPerPattern: 16,
  channels: [
    { name: 'lead', instrument: { wave: 'square', attack: 0.01, release: 0.12, gain: 0.16 } },
    { name: 'bass', instrument: { wave: 'triangle', attack: 0.01, release: 0.08, gain: 0.3 } },
    { name: 'pad', instrument: { wave: 'sine', attack: 0.15, release: 0.4, gain: 0.12 } },
    { name: 'perc', instrument: { wave: 'noise', attack: 0, release: 0.05, gain: 0.12 } },
  ],
  patterns: {
    lead1: ['E5:2', 'C5:1', 'D5:1', 'E5:2', 'A5:2', 'G5:2', 'E5:2', 'F5:1', 'E5:1', 'C5:2'],
    lead2: ['G5:2', 'E5:1', 'G5:1', 'C6:2', 'G5:2', 'D5:2', 'G5:2', 'E5:2', 'D5:2'],
    lead3: ['A5:2', 'G5:1', 'E5:1', 'C5:2', 'E5:2', 'F5:3', 'E5:1', 'C5:2', 'A4:2'],
    lead4: ['D5:2', 'E5:2', 'G5:2', 'E5:2', 'A5:4', 'E5:2', '.:2'],
    bassAmF: ['A2:2', 'A3:2', 'A2:2', 'E3:2', 'F2:2', 'F3:2', 'F2:2', 'C3:2'],
    bassCG: ['C3:2', 'C4:2', 'C3:2', 'G3:2', 'G2:2', 'G3:2', 'G2:2', 'D3:2'],
    bassGAm: ['G2:2', 'G3:2', 'G2:2', 'D3:2', 'A2:2', 'A3:2', 'A2:2', 'E3:2'],
    padAmF: ['A3:8', 'F3:8'],
    padCG: ['C4:8', 'B3:8'],
    padGAm: ['B3:8', 'A3:8'],
    perc: [
      'C3:2',
      'C7:1',
      'C7:1',
      'C3:1',
      'C7:1',
      'C7:2',
      'C3:2',
      'C7:1',
      'C7:1',
      'C3:1',
      'C7:1',
      'C7:1',
      'C3:1',
    ],
  },
  order: [
    ['lead1', 'bassAmF', 'padAmF', 'perc'],
    ['lead2', 'bassCG', 'padCG', 'perc'],
    ['lead3', 'bassAmF', 'padAmF', 'perc'],
    ['lead4', 'bassGAm', 'padGAm', 'perc'],
    ['lead3', 'bassAmF', 'padAmF', 'perc'],
    ['lead2', 'bassCG', 'padCG', 'perc'],
    ['lead1', 'bassAmF', 'padAmF', 'perc'],
    ['lead4', 'bassGAm', 'padGAm', 'perc'],
  ],
};
