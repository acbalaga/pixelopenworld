import type { BossDef } from './types';

/**
 * The Millrace Eel (POW-M4-11, regions/01 section 8). It strikes from the flooded channel and
 * cannot be hurt below 60% Health until the low-water sluice has been thrown, so it is fought at
 * low water. Below half Health it adds the lash and the channel's marked tiles surge. The other
 * way: throw the low-water sluice, then the weir sluice, and the water keeps it out.
 */
export const MILLRACE_EEL_BOSS: BossDef = {
  id: 'boss.millrace_eel',
  creature: 'creature.millrace_eel',
  title: 'boss.millrace_eel.title',
  dungeon: 'dungeon.undermill',
  callouts: { 'attack.eel_lash': 'callout.millrace_eel.lash' },
  phases: [
    {
      enter: { hpPct: 100 },
      pattern: [
        { attack: 'attack.eel_snap', wait: 30 },
        { attack: 'attack.eel_snap', wait: 50 },
      ],
      gate: { holdHpPct: 60, until: 'fixture.um_sluice_c' },
    },
    {
      enter: { hpPct: 50 },
      pattern: [
        { attack: 'attack.eel_snap', wait: 24 },
        { attack: 'attack.eel_lash', wait: 60 },
      ],
      hazards: [
        {
          tiles: [
            [-5, 0],
            [5, 0],
            [0, -4],
            [0, 4],
            [-4, 3],
            [4, -3],
          ],
          telegraph: 45,
          active: 12,
          period: 130,
          damage: 40,
        },
      ],
    },
  ],
  objective: {
    title: 'boss.millrace_eel.kept_out',
    steps: [
      { id: 'low', requires: [], done: { fixtureOpen: 'fixture.um_sluice_c' } },
      { id: 'weir', requires: ['low'], done: { fixtureOpen: 'fixture.um_sluice_d' } },
    ],
  },
};
