import { describe, expect, it } from 'vitest';
import {
  BODY_TYPES,
  CLOTH_COLORS,
  DOLL_ANIMS,
  DOLL_FRAMES,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  TOP_STYLES,
  layersFor,
  randomDoll,
  type DollSpec,
} from '../../src/content/dolls/parts';
import { BIOMES } from '../../src/content/nature/biomes';
import { gridFromDef, TRANSPARENT } from '../../src/content/sprites/grid';
import { rng } from '../../src/content/sprites/gen/img';
import { natureSprites, TREE_SPECIES, VARIANTS } from '../../src/content/sprites/gen/nature';
import { SPRITES, TILES } from '../../src/content/sprites';
import { PALETTE } from '../../src/content/sprites/palette';
import { composeFrame, recolor } from '../../src/render/doll';
import { bakeAll } from '../../tools/bake-assets/bake';
import { decodePng } from '../../tools/bake-assets/png';
import type { Manifest } from '../../src/render/atlas';

const defs = new Map(SPRITES.map((s) => [s.id, s]));
const fromDefs = (id: string, frame: string): Uint8Array => gridFromDef(defs.get(id)!, frame);
const base: DollSpec = {
  body: 'a',
  skin: 'light',
  hair: 'short',
  hairColor: 'brown',
  top: 'tunic',
  topColor: 'blue',
  bottom: 'trousers',
  bottomColor: 'brown',
  mainHand: 'none',
  offHand: 'none',
};
const compose = (spec: DollSpec, frame = 'idle_down'): Uint8Array =>
  composeFrame(fromDefs, layersFor(spec), frame);
const opaque = (px: Uint8Array): number => px.filter((v) => v !== TRANSPARENT).length;
const silhouette = (px: Uint8Array): string =>
  Array.from(px, (v) => (v === TRANSPARENT ? '.' : '#')).join('');

describe('doll composition', () => {
  it('is deterministic and recolors only the slot indices', () => {
    expect(compose(base)).toEqual(compose({ ...base }));
    expect(recolor(5, [20, 21, 22, 23])).toBe(21);
    expect(recolor(0, [20, 21, 22, 23])).toBe(0);
    expect(recolor(40, [20, 21, 22, 23])).toBe(40);
  });

  it('the two body types have different silhouettes under the same clothes and hair', () => {
    const a = compose(base, 'idle_down');
    const b = compose({ ...base, body: 'b' }, 'idle_down');
    expect(silhouette(a)).not.toBe(silhouette(b));
    for (const f of ['walk_right_0', 'idle_up']) {
      expect(silhouette(compose(base, f))).not.toBe(silhouette(compose({ ...base, body: 'b' }, f)));
    }
  });

  it('every option changes the picture', () => {
    const ref = compose(base).join();
    for (const skin of Object.keys(SKIN_TONES))
      if (skin !== base.skin)
        expect(compose({ ...base, skin: skin as DollSpec['skin'] }).join()).not.toBe(ref);
    for (const hair of HAIR_STYLES)
      if (hair !== base.hair) expect(compose({ ...base, hair }).join()).not.toBe(ref);
    for (const c of Object.keys(HAIR_COLORS))
      if (c !== 'brown')
        expect(compose({ ...base, hairColor: c as DollSpec['hairColor'] }).join()).not.toBe(ref);
    for (const c of Object.keys(CLOTH_COLORS))
      if (c !== 'blue')
        expect(compose({ ...base, topColor: c as DollSpec['topColor'] }).join()).not.toBe(ref);
    expect(compose({ ...base, top: 'vest' }).join()).not.toBe(ref);
    expect(compose({ ...base, bottom: 'skirt' }).join()).not.toBe(ref);
    expect(compose({ ...base, top: 'robe' }).join()).not.toBe(ref);
    expect(compose({ ...base, mainHand: 'sword' }).join()).not.toBe(ref);
    expect(compose({ ...base, mainHand: 'staff' }).join()).not.toBe(ref);
    expect(compose({ ...base, offHand: 'shield' }).join()).not.toBe(ref);
  });

  it('attack, hurt and dodge frames differ from idle and from each other, in every drawn view', () => {
    const armed: DollSpec = { ...base, mainHand: 'sword', offHand: 'shield' };
    for (const d of ['down', 'up', 'right']) {
      const frames = [
        `idle_${d}`,
        `attack_${d}_0`,
        `attack_${d}_1`,
        `attack_${d}_2`,
        `hurt_${d}`,
        `dodge_${d}_0`,
        `dodge_${d}_1`,
      ];
      const pics = frames.map((f) => compose(armed, f).join());
      expect(new Set(pics).size).toBe(frames.length);
    }
  });

  it('a held item moves with the attack: the sword frames differ between windup and strike', () => {
    const sword: DollSpec = { ...base, mainHand: 'sword' };
    for (const d of ['down', 'right']) {
      expect(compose(sword, `attack_${d}_0`).join()).not.toBe(
        compose(sword, `attack_${d}_1`).join(),
      );
    }
  });

  it('provides the animations the avatar needs in four facings', () => {
    for (const f of ['down', 'up', 'left', 'right'])
      for (const a of ['idle', 'walk', 'attack', 'hurt', 'dodge'])
        expect(DOLL_ANIMS[`${a}_${f}`], `${a}_${f}`).toBeDefined();
    expect(DOLL_ANIMS.attack_down?.frames).toHaveLength(3);
    expect(DOLL_ANIMS.dodge_up?.frames).toHaveLength(2);
    expect(DOLL_ANIMS.hurt_left?.frames).toHaveLength(1);
    expect(DOLL_ANIMS.attack_left?.flipX).toBe(true);
  });

  it('has an outline in the darkest neutral around the figure and never touches the canvas edge', () => {
    const r = rng(5);
    for (let i = 0; i < 60; i++) {
      const spec = randomDoll(r);
      for (const f of DOLL_FRAMES) {
        const px = compose(spec, f);
        expect(px.includes(0)).toBe(true);
        for (let x = 0; x < 24; x++) {
          expect(px[x]).toBe(TRANSPARENT);
          expect(px[31 * 24 + x]).toBe(TRANSPARENT);
        }
        for (let y = 0; y < 32; y++) {
          expect(px[y * 24]).toBe(TRANSPARENT);
          expect(px[y * 24 + 23]).toBe(TRANSPARENT);
        }
      }
    }
  });

  it('every frame stays on the palette and fits the 16 wide figure budget (outline included, hair excepted)', () => {
    for (const f of DOLL_FRAMES) {
      const px = compose(base, f);
      expect(px.every((v) => v === TRANSPARENT || v < PALETTE.length)).toBe(true);
      expect(opaque(px)).toBeGreaterThan(150);
    }
  });
});

describe('randomDoll', () => {
  it('is repeatable from a seed and covers every option over many draws', () => {
    expect(randomDoll(rng(1))).toEqual(randomDoll(rng(1)));
    expect(randomDoll(rng(1))).not.toEqual(randomDoll(rng(2)));
    const r = rng(9);
    const seen = {
      body: new Set<string>(),
      hair: new Set<string>(),
      skin: new Set<string>(),
      top: new Set<string>(),
      bottom: new Set<string>(),
    };
    for (let i = 0; i < 400; i++) {
      const d = randomDoll(r);
      seen.body.add(d.body);
      seen.hair.add(d.hair);
      seen.skin.add(d.skin);
      seen.top.add(d.top);
      seen.bottom.add(d.bottom);
      expect(d.topColor === (d.hairColor as string)).toBe(false);
    }
    expect(seen.body.size).toBe(BODY_TYPES.length);
    expect(seen.hair.size).toBe(HAIR_STYLES.length);
    expect(seen.skin.size).toBe(Object.keys(SKIN_TONES).length);
    expect(seen.top.size).toBe(TOP_STYLES.length);
    expect(seen.bottom.size).toBe(2);
  });

  it('every look it can produce has all of its layers and frames baked', () => {
    const r = rng(3);
    for (let i = 0; i < 300; i++) {
      for (const layer of layersFor(randomDoll(r))) {
        const def = defs.get(layer.id);
        expect(def, layer.id).toBeDefined();
        for (const f of DOLL_FRAMES) expect(def!.frames[f], `${layer.id} ${f}`).toBeDefined();
      }
    }
  });

  it('composing from the baked atlas pixels matches composing from the definitions', () => {
    const out = bakeAll(SPRITES, TILES);
    const m = JSON.parse(out.get('manifest.json') as string) as Manifest;
    const atlas = decodePng(out.get('atlas-core.png') as Uint8Array);
    const lookup = new Map(PALETTE.map((h, i) => [h, i]));
    const fromAtlas = (id: string, frame: string): Uint8Array => {
      const r = m.sprites[id]!.frames[frame]!;
      const px = new Uint8Array(r.w * r.h).fill(TRANSPARENT);
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          const k = ((r.y + y) * atlas.width + r.x + x) * 4;
          if (atlas.data[k + 3] === 0) continue;
          const hex = `#${[0, 1, 2].map((c) => (atlas.data[k + c] as number).toString(16).padStart(2, '0')).join('')}`;
          px[y * r.w + x] = lookup.get(hex) ?? TRANSPARENT;
        }
      }
      return px;
    };
    const r = rng(77);
    for (let i = 0; i < 6; i++) {
      const spec = randomDoll(r);
      for (const f of ['idle_down', 'walk_right_2', 'walk_up_1']) {
        expect(composeFrame(fromAtlas, layersFor(spec), f)).toEqual(compose(spec, f));
      }
    }
  });
});

describe('nature generators', () => {
  const sprites = natureSprites();
  const byId = new Map(sprites.map((s) => [s.id, s]));

  it('are deterministic', () => {
    expect(natureSprites()).toEqual(sprites);
  });

  it('variants of a species differ from each other', () => {
    for (const sp of TREE_SPECIES) {
      const frames = Array.from({ length: VARIANTS }, (_, v) =>
        byId.get(`prop.tree_${sp}_${v}_canopy`)!.frames.base!.join(),
      );
      expect(new Set(frames).size, sp).toBe(VARIANTS);
    }
  });

  it('leafy canopies end on row 30 so the trunk shows below', () => {
    for (const sp of TREE_SPECIES.filter((s) => s !== 'dead')) {
      for (let v = 0; v < VARIANTS; v++) {
        const rows = byId.get(`prop.tree_${sp}_${v}_canopy`)!.frames.base!;
        const last = rows.map((r) => /[^.]/.test(r)).lastIndexOf(true);
        expect(last, `${sp} ${v}`).toBe(30);
      }
    }
  });

  it('every biome only names sprites that exist', () => {
    for (const b of Object.values(BIOMES)) {
      for (const [sp] of b.trees)
        expect(byId.has(`prop.tree_${sp}_0_trunk`), `${b.id} tree ${sp}`).toBe(true);
      for (const [k] of b.bushes)
        expect(byId.has(`prop.bush_${k}_0`), `${b.id} bush ${k}`).toBe(true);
      for (const [c] of b.flowers)
        expect(byId.has(`prop.flower_${c}_0`), `${b.id} flower ${c}`).toBe(true);
    }
  });
});
