import type { BossDef } from './types';

/**
 * Old Bramblehide, the Rootway's miniboss (POW-M4-21, regions/01 section 8, R8). Phase one is a
 * gore and a charge with a long tell: it paws the ground for a full second before it runs. Phase
 * two, below half Health, calls three boarlets and brings roots up through marked tiles of the
 * den, each shown for a second and a half before it bursts.
 */
export const OLD_BRAMBLEHIDE_BOSS: BossDef = {
  id: 'boss.old_bramblehide',
  creature: 'creature.old_bramblehide',
  title: 'boss.old_bramblehide.title',
  dungeon: 'dungeon.rootway',
  phases: [
    {
      enter: { hpPct: 100 },
      pattern: [
        { attack: 'attack.boss_gore', wait: 24 },
        { attack: 'attack.bramble_charge', wait: 60 },
      ],
    },
    {
      enter: { hpPct: 50 },
      summon: { creature: 'creature.boarlet', count: 3, radius: 4 },
      pattern: [
        { attack: 'attack.boss_gore', wait: 20 },
        { attack: 'attack.boss_slam', wait: 40 },
        { attack: 'attack.bramble_charge', wait: 50 },
      ],
      hazards: [
        {
          // Roots come up in the corners of the den and in a line across it.
          tiles: [
            [-6, -3],
            [6, -3],
            [-6, 4],
            [6, 4],
            [0, 5],
            [-3, 0],
            [3, 0],
          ],
          telegraph: 45,
          active: 12,
          period: 120,
          damage: 45,
        },
      ],
    },
  ],
};
