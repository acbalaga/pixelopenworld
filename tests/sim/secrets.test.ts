import { describe, expect, it } from 'vitest';
import { TIME } from '../../src/content/balance/time';
import { REGION_SECRETS, DUNGEON_SECRETS, BEE_DOOR } from '../../src/content/pois/secrets';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { FIXTURES } from '../../src/content/world/fixtures';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { getComp } from '../../src/sim/kernel/entities';
import { addItem } from '../../src/sim/items';
import { createDemoState, type SimState } from '../../src/sim/state';
import { dungeonSystem } from '../../src/sim/systems/dungeon';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { CHUNK_TILES, Solid, decodeChunk } from '../../src/sim/world/chunk';
import { bakeRegion } from '../../tools/bake-world/bake';
import { validateRegion } from '../../tools/bake-world/validateRegion';

const OPEN = { solidAt: (): number => 0 };
function world(): { s: SimState; me: number } {
  const s = createDemoState(5, 0);
  s.world = OPEN;
  s.region = 'dawnmeadow';
  s.weatherOverride = 'clear';
  const f = feetAt(10, 10);
  return { s, me: createAvatar(s, f.x, f.y) };
}
const flags = (s: SimState, me: number): string[] => getComp(s.entities, me, 'journal')!.flags;
/** Runs the dungeon system at a world tick that is a multiple of 15. */
const at = (s: SimState, tick: number): void => {
  s.worldTick = tick - (tick % 15);
  dungeonSystem(s);
};
/** The tick at which the in-game clock reads this minute of the day (0 is the start of dawn). */
const minute = (m: number): number => ((m - TIME.startMinute + 48) % 48) * TIME.ticksPerMinute;

describe('Dawnmeadow secrets (M4-11)', () => {
  it('are six in the open and four in the dungeons, a fifth or more by non-combat skills', () => {
    expect(REGION_SECRETS).toHaveLength(6);
    expect(DUNGEON_SECRETS).toHaveLength(4);
    expect(DAWNMEADOW.secrets).toHaveLength(10);
    const files = bakeRegion(DAWNMEADOW, STAMPS);
    expect(validateRegion(DAWNMEADOW, files).filter((e) => e.includes('secrets'))).toEqual([]);
    // Take the skills away and the bake refuses it.
    const bare = { ...DAWNMEADOW, secrets: (DAWNMEADOW.secrets ?? []).map((x) => ({ id: x.id })) };
    expect(validateRegion(bare, files).some((e) => e.includes('non-combat skill route'))).toBe(
      true,
    );
  });

  it('place a chest each, and a vigil or a door for the ones that wake', () => {
    const files = bakeRegion(DAWNMEADOW, STAMPS);
    const open = (x: number, y: number): boolean => {
      const c = decodeChunk(
        files.get(
          `dawnmeadow/chunk-${Math.floor(x / CHUNK_TILES)}-${Math.floor(y / CHUNK_TILES)}.bin`,
        ) as Uint8Array,
      );
      return c.collision[(y % CHUNK_TILES) * CHUNK_TILES + (x % CHUNK_TILES)] === Solid.None;
    };
    for (const s of REGION_SECRETS) {
      const kind = `fixture.sec_${s.id}_chest`;
      expect(FIXTURES[kind], kind).toBeDefined();
      expect(DAWNMEADOW.placements.filter((p) => p.kind === kind)).toHaveLength(1);
      expect(open(s.chest.x, s.chest.y), `${s.id} chest`).toBe(true);
      if (s.flag) expect(FIXTURES[kind]!.needsFlag).toBe(s.flag);
      if (s.trigger) {
        expect(FIXTURES[s.vigil!]?.type).toBe('vigil');
        expect(FIXTURES[s.vigil!]?.secret?.flag).toBe(s.flag);
      }
    }
    expect(DAWNMEADOW.placements.some((p) => p.kind === 'fixture.sec_bee_door')).toBe(true);
    expect(open(BEE_DOOR.x, BEE_DOOR.y)).toBe(true);
  });

  it('sundial: wakes at noon on a clear day, and not at night or in rain', () => {
    const { s, me } = world();
    spawnFixture(s, 'fixture.sec_sundial_vigil', 10, 10);
    at(s, minute(2));
    expect(flags(s, me)).not.toContain('secret.sundial');
    s.weatherOverride = 'rain';
    at(s, minute(19));
    expect(flags(s, me)).not.toContain('secret.sundial');
    s.weatherOverride = 'clear';
    at(s, minute(19));
    expect(flags(s, me)).toContain('secret.sundial');
  });

  it('painter: wants dawn, dusk and night, in any order', () => {
    const { s, me } = world();
    spawnFixture(s, 'fixture.sec_painter_vigil', 10, 10);
    at(s, minute(1)); // dawn
    at(s, minute(40)); // night
    expect(flags(s, me)).not.toContain('secret.painter');
    at(s, minute(36)); // dusk
    expect(flags(s, me)).toContain('secret.painter');
  });

  it('bell stone and spring grotto: want Performance 15 and Athletics 20', () => {
    const { s, me } = world();
    spawnFixture(s, 'fixture.sec_bell_vigil', 10, 10);
    spawnFixture(s, 'fixture.sec_lark_vigil', 10, 10);
    at(s, minute(5));
    expect(flags(s, me)).not.toContain('secret.bell_stone');
    expect(flags(s, me)).not.toContain('secret.lark_grotto');
    const sk = getComp(s.entities, me, 'skills')!;
    sk.points['skill.performance'] = 15;
    sk.points['skill.athletics'] = 20;
    at(s, minute(5));
    expect(flags(s, me)).toContain('secret.bell_stone');
    expect(flags(s, me)).toContain('secret.lark_grotto');
  });

  it('beekeeper: the gate wants a honey cake', () => {
    expect(FIXTURES['fixture.sec_bee_door']).toMatchObject({
      type: 'door',
      key: 'item.honey_cake',
    });
    void addItem;
  });
});
