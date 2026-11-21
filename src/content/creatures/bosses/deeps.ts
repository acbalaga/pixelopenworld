import type { BossDef } from './types';

const rail = (axis: 'x' | 'y', at: number): [number, number][] =>
  Array.from({ length: 11 }, (_v, i) => (axis === 'x' ? [i - 5, at] : [at, i - 5]));

/**
 * The Foreman's Engine (POW-M4-11, regions/01 section 8). Phase one rams along the floor. Each
 * later phase lays more rail that it rides on: the marked tiles hurt when its carriage comes
 * through. The other way: Tinkering 15 jams its gears at the gear box, and it stops.
 */
export const FOREMANS_ENGINE_BOSS: BossDef = {
  id: 'boss.foremans_engine',
  creature: 'creature.foremans_engine',
  title: 'boss.foremans_engine.title',
  dungeon: 'dungeon.deeps',
  callouts: {
    'attack.engine_ram': 'callout.foremans_engine.ram',
    'attack.engine_steam': 'callout.foremans_engine.steam',
  },
  phases: [
    {
      enter: { hpPct: 100 },
      pattern: [
        { attack: 'attack.engine_ram', wait: 50 },
        { attack: 'attack.engine_steam', wait: 40 },
      ],
    },
    {
      enter: { hpPct: 70 },
      pattern: [
        { attack: 'attack.engine_ram', wait: 40 },
        { attack: 'attack.engine_steam', wait: 30 },
      ],
      hazards: [{ tiles: rail('x', 0), telegraph: 45, active: 12, period: 140, damage: 40 }],
    },
    {
      enter: { hpPct: 35 },
      pattern: [
        { attack: 'attack.engine_ram', wait: 30 },
        { attack: 'attack.engine_steam', wait: 24 },
      ],
      hazards: [
        { tiles: rail('x', 0), telegraph: 45, active: 12, period: 120, damage: 40 },
        { tiles: rail('y', 0), telegraph: 45, active: 12, period: 120, damage: 40 },
      ],
    },
  ],
  objective: {
    title: 'boss.foremans_engine.jammed',
    steps: [{ id: 'jam', requires: [], done: { fixtureOpen: 'fixture.sd_gear_jam' } }],
  },
};
