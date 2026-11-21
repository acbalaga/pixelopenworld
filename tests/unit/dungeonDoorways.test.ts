import { describe, expect, it } from 'vitest';
import { BUILT_DUNGEONS } from '../../src/content/world/dungeons/registry';

/**
 * G4 playtest: every way on inside a dungeon looked like a secret door, because the portals had no
 * art. Each portal a person can walk through from inside a room now has an arch, in the wall
 * behind it or on its own tile.
 */
describe('dungeon doorways (POW-M5-20)', () => {
  for (const d of BUILT_DUNGEONS) {
    it(`${d.def.id}: every way on shows an arch`, () => {
      const stamps = d.stamps;
      const archNear = (room: string, t: { x: number; y: number }): boolean => {
        const i = d.def.rooms.findIndex((r) => r.id === room);
        const rows = stamps[i]!.layers.object ?? [];
        return [
          [0, 0],
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ].some(([dx, dy]) => rows[t.y + dy!]?.[t.x + dx!] === 'A');
      };
      const s = d.spec;
      for (const e of s.edges) {
        expect(archNear(e.from, e.at), `${e.from} to ${e.to}`).toBe(true);
        if (e.kind === 'open' || e.kind === 'locked')
          expect(archNear(e.to, e.arrive), `${e.to} back to ${e.from}`).toBe(true);
      }
      expect(archNear(s.def.entrance, s.mouth.exit), 'the way out').toBe(true);
    });
  }
});
