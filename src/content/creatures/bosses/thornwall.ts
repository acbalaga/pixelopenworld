import { BELL_ORDER } from '../../world/dungeons/west';
import type { BossDef } from './types';

const line = (axis: 'x' | 'y', at: number): [number, number][] =>
  Array.from({ length: 9 }, (_v, i) => (axis === 'x' ? [i - 4, at] : [at, i - 4]));

/**
 * The Hedge Warden (POW-M4-11, regions/01 section 8), three phases: a briar lash; thorn walls that
 * split the arena; and a rooted bloom that keeps it from falling below a quarter of its Health
 * until the bloom is burnt or cut. The other way: ring the Keeper's Bells in order, then sing at
 * its root (Performance 30). It sleeps, the gate opens, and the reward is the same.
 */
export const HEDGE_WARDEN_BOSS: BossDef = {
  id: 'boss.hedge_warden',
  creature: 'creature.hedge_warden',
  title: 'boss.hedge_warden.title',
  dungeon: 'dungeon.thornwall',
  phases: [
    {
      enter: { hpPct: 100 },
      pattern: [
        { attack: 'attack.warden_lash', wait: 40 },
        { attack: 'attack.warden_thorns', wait: 50 },
      ],
    },
    {
      enter: { hpPct: 66 },
      pattern: [
        { attack: 'attack.warden_lash', wait: 30 },
        { attack: 'attack.warden_thorns', wait: 40 },
      ],
      hazards: [
        // Thorn walls: a column through the middle of the arena, and a row across it.
        { tiles: line('y', 0), telegraph: 45, active: 14, period: 150, damage: 40 },
      ],
    },
    {
      enter: { hpPct: 33 },
      pattern: [
        { attack: 'attack.warden_lash', wait: 26 },
        { attack: 'attack.warden_thorns', wait: 34 },
      ],
      hazards: [
        { tiles: line('y', 0), telegraph: 45, active: 14, period: 130, damage: 40 },
        { tiles: line('x', 0), telegraph: 45, active: 14, period: 130, damage: 40 },
      ],
      // The bloom heals it: Health holds at a quarter until the bloom is burnt or cut.
      gate: { holdHpPct: 25, until: 'fixture.tw_bloom' },
    },
  ],
  objective: {
    title: 'boss.hedge_warden.slept',
    steps: [
      // The last bell of the carved order.
      {
        id: 'bells',
        requires: [],
        done: { fixtureOpen: `fixture.tw_bell_${BELL_ORDER[BELL_ORDER.length - 1]}` },
      },
      { id: 'song', requires: ['bells'], done: { fixtureOpen: 'fixture.tw_root' } },
    ],
  },
};
