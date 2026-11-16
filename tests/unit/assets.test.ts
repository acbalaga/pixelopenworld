import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SPRITES, TILES } from '../../src/content/sprites';
import { PALETTE, ALL_RAMPS } from '../../src/content/sprites/palette';
import type { SpriteDef } from '../../src/content/sprites/types';
import { bakeAll } from '../../tools/bake-assets/bake';
import { validateDefs } from '../../tools/bake-assets/validate';
import { Atlas, type Manifest } from '../../src/render/atlas';

const good: SpriteDef = {
  id: 'test.thing',
  group: 'core',
  size: [4, 2],
  origin: [2, 2],
  key: { '.': null, a: 3 },
  frames: { f0: ['.aa.', 'a..a'] },
};
const with_ = (patch: Partial<SpriteDef>): SpriteDef => ({ ...good, ...patch });

describe('palette', () => {
  it('has 32 colors in 8 ramps of 4, all valid hex, no duplicates', () => {
    expect(PALETTE).toHaveLength(32);
    expect(new Set(PALETTE).size).toBe(32);
    expect(ALL_RAMPS).toHaveLength(8);
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(ALL_RAMPS.flatMap((r) => r.indices).sort((a, b) => a - b)).toEqual([
      ...Array(32).keys(),
    ]);
  });

  it('ramps get lighter step by step', () => {
    const lum = (c: string): number => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
      ];
      return 0.3 * r + 0.59 * g + 0.11 * b;
    };
    for (const r of ALL_RAMPS) {
      const l = r.indices.map((i) => lum(PALETTE[i] as string));
      expect([...l].sort((a, b) => a - b)).toEqual(l);
    }
  });
});

describe('validation', () => {
  it('accepts the shipped content', () => {
    expect(validateDefs(SPRITES, TILES)).toEqual([]);
  });

  it('wrong row width names sprite, frame and row', () => {
    const e = validateDefs([with_({ frames: { f0: ['.aa.', 'a..'] } })], []);
    expect(e).toEqual(['sprite test.thing frame f0 row 1: width 3, expected 4']);
  });

  it('unknown key character names sprite, frame and row', () => {
    const e = validateDefs([with_({ frames: { f0: ['.aa.', 'a.z.'] } })], []);
    expect(e).toEqual(["sprite test.thing frame f0 row 1: unknown key character 'z'"]);
  });

  it('out-of-palette index names sprite, frame and row', () => {
    const e = validateDefs([with_({ key: { '.': null, a: 40 } })], []);
    expect(
      e.some((m) =>
        m.startsWith("sprite test.thing frame f0 row 0: character 'a' maps to palette index 40"),
      ),
    ).toBe(true);
  });

  it('wrong row count, bad anim frame, bad origin, bad tile refs', () => {
    expect(validateDefs([with_({ frames: { f0: ['.aa.'] } })], [])[0]).toContain(
      '1 rows, expected 2',
    );
    expect(validateDefs([with_({ anims: { go: { frames: ['nope'], fps: 4 } } })], [])[0]).toContain(
      "unknown frame 'nope'",
    );
    expect(validateDefs([with_({ origin: [9, 0] })], [])[0]).toContain('origin');
    const tile = {
      id: 'tile.t',
      sprite: 'test.nope',
      frame: 'f0',
      layer: 'ground',
      collision: 'none',
      tags: [],
    } as const;
    expect(validateDefs([good], [tile])[0]).toContain("unknown sprite 'test.nope'");
    expect(validateDefs([good], [{ ...tile, sprite: 'test.thing', frame: 'zz' }])[0]).toContain(
      "no frame 'zz'",
    );
  });

  it('bake refuses invalid content with every error listed', () => {
    expect(() => bakeAll([with_({ frames: { f0: ['.aa.', 'a..'] } })], [])).toThrow(
      /row 1: width 3/,
    );
  });
});

describe('bake', () => {
  it('running twice gives byte-identical output', () => {
    const a = bakeAll(SPRITES, TILES);
    const b = bakeAll(SPRITES, TILES);
    expect([...a.keys()]).toEqual([...b.keys()]);
    for (const [k, v] of a)
      expect(Buffer.from(v)).toEqual(Buffer.from(b.get(k) as Uint8Array | string));
  });

  it('committed baked/ matches the definitions (the CI drift check, run here too)', () => {
    const out = bakeAll(SPRITES, TILES);
    const dir = join(__dirname, '..', '..', 'baked');
    const on = readdirSync(dir)
      .filter((n) => n !== '.gitkeep')
      .sort();
    expect(on).toEqual([...out.keys()].sort());
    expect(readFileSync(join(dir, 'manifest.json'), 'utf8')).toBe(out.get('manifest.json'));
  });

  it('frames do not overlap in the atlas and stay inside it', () => {
    const m = JSON.parse(bakeAll(SPRITES, TILES).get('manifest.json') as string) as Manifest;
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    for (const s of Object.values(m.sprites)) rects.push(...Object.values(s.frames));
    const a = m.atlases.core as { width: number; height: number };
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(a.width);
      expect(r.y + r.h).toBeLessThanOrEqual(a.height);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const p = rects[i] as (typeof rects)[number];
        const q = rects[j] as (typeof rects)[number];
        expect(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y).toBe(
          true,
        );
      }
    }
  });
});

describe('runtime atlas', () => {
  const m = JSON.parse(bakeAll(SPRITES, TILES).get('manifest.json') as string) as Manifest;
  const atlas = new Atlas(m, { core: {} as CanvasImageSource });

  it('resolves handles and rejects unknown names', () => {
    const h = atlas.frame('char.placeholder_humanoid', 'walk_down_0');
    expect(atlas.width(h)).toBe(24);
    expect(atlas.height(h)).toBe(32);
    expect(atlas.originX(h)).toBe(12);
    expect(() => atlas.frame('nope', 'x')).toThrow();
    expect(() => atlas.anim('tile.water', 'nope')).toThrow();
  });

  it('plays animations by time and loops', () => {
    const walk = atlas.anim('char.placeholder_humanoid', 'walk_down');
    const f = (ms: number): number => atlas.animFrame(walk, ms);
    expect(f(0)).toBe(atlas.frame('char.placeholder_humanoid', 'walk_down_0'));
    expect(f(125)).toBe(atlas.frame('char.placeholder_humanoid', 'walk_down_1'));
    expect(f(375)).toBe(atlas.frame('char.placeholder_humanoid', 'walk_down_3'));
    expect(f(500)).toBe(f(0));
    expect(atlas.animFlip(walk)).toBe(false);
    expect(atlas.animFlip(atlas.anim('char.placeholder_humanoid', 'walk_left'))).toBe(true);
  });
});
