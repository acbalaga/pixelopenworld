import type { BossDef } from './types';

/**
 * A three phase sample used by the scenario tests and as the template for real bosses. Phase one
 * is a gore and a charge on a pattern. Phase two adds slam hazards on marked tiles and holds
 * Health until a switch is thrown. Phase three speeds the pattern. The objective route needs the
 * gate opened and a key carried to it.
 */
export const SAMPLE_BOSS: BossDef = {
  id: 'boss.sample',
  creature: 'creature.old_bramblehide',
  title: 'boss.sample.title',
  phases: [
    {
      enter: { hpPct: 100 },
      pattern: [
        { attack: 'attack.boss_gore', wait: 20 },
        { attack: 'attack.boss_charge', wait: 60 },
      ],
    },
    {
      enter: { hpPct: 66 },
      pattern: [
        { attack: 'attack.boss_gore', wait: 20 },
        { attack: 'attack.boss_slam', wait: 50 },
      ],
      hazards: [
        {
          tiles: [
            [2, 0],
            [-2, 0],
          ],
          telegraph: 30,
          active: 15,
          period: 120,
          damage: 40,
        },
      ],
      gate: { holdHpPct: 40, until: 'fixture.switch' },
    },
    {
      enter: { hpPct: 33 },
      pattern: [
        { attack: 'attack.boss_gore', wait: 10 },
        { attack: 'attack.boss_charge', wait: 30 },
        { attack: 'attack.boss_slam', wait: 30 },
      ],
    },
  ],
  objective: {
    title: 'boss.sample.title_objective',
    steps: [
      { id: 'open_gate', requires: [], done: { fixtureOpen: 'fixture.gate_switch' } },
      { id: 'bring_key', requires: ['open_gate'], done: { item: 'item.old_key', qty: 1 } },
    ],
  },
  dungeon: 'dungeon.sample',
};
