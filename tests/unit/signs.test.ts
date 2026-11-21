import { describe, expect, it } from 'vitest';
import { PLACED_SIGNS, SIGN_IDS, signKind } from '../../src/content/pois/signs';
import { SIGN_STRINGS } from '../../src/content/strings/signs';
import { FIXTURES } from '../../src/content/world/fixtures';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { getComp } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState } from '../../src/sim/state';
import { interactFixture, spawnFixture } from '../../src/sim/systems/fixtures';
import { CHUNK_TILES, Solid, decodeChunk } from '../../src/sim/world/chunk';
import { bakeRegion } from '../../tools/bake-world/bake';

describe('readable signs', () => {
  it('have a fixture and a line each, with no em dash and no long speeches', () => {
    for (const id of SIGN_IDS) {
      expect(FIXTURES[signKind(id)]?.type, id).toBe('sign');
      const t = SIGN_STRINGS[`sign.${id}`]!;
      expect(t, id).toBeTruthy();
      expect(t, id).not.toMatch(/[—–]/);
      expect(t.length, id).toBeLessThanOrEqual(90);
    }
  });

  it('are each placed once, in a stamp or by the region, and the placed ones stand on open ground', () => {
    const inStamps = (kind: string): number =>
      Object.values(STAMPS).reduce(
        (n, s) => n + (s.objects ?? []).filter((o) => o.kind === kind).length,
        0,
      );
    const files = bakeRegion(DAWNMEADOW, STAMPS);
    for (const id of SIGN_IDS) {
      const kind = signKind(id);
      const placed = DAWNMEADOW.placements.filter((p) => p.kind === kind).length;
      expect(placed + inStamps(kind), id).toBe(1);
    }
    for (const s of PLACED_SIGNS) {
      const c = decodeChunk(
        files.get(
          `dawnmeadow/chunk-${Math.floor(s.x / CHUNK_TILES)}-${Math.floor(s.y / CHUNK_TILES)}.bin`,
        ) as Uint8Array,
      );
      expect(c.collision[(s.y % CHUNK_TILES) * CHUNK_TILES + (s.x % CHUNK_TILES)], s.id).toBe(
        Solid.None,
      );
    }
  });

  it('send their text when read from the front', () => {
    const s = createDemoState(5, 0);
    s.world = { solidAt: (): number => 0 };
    const me = createAvatar(s, px(10 * 16 + 8), px(11 * 16 + 16));
    getComp(s.entities, me, 'avatar')!.facing = 0;
    spawnFixture(s, 'fixture.sign_milestone', 10, 10);
    interactFixture(s, me);
    const e = s.events.list.find((x) => x.type === 'signRead');
    expect(e).toMatchObject({ type: 'signRead', kind: 'fixture.sign_milestone' });
    void feetAt;
  });
});
