import { describe, expect, it } from 'vitest';
import { SPRITES } from '../../src/content/sprites';
import type { SpriteDef } from '../../src/content/sprites/types';
import { lookAlikePairs, pixelDistance } from '../../tools/bake-assets/lookalike';
import { validateItemIcons } from '../../tools/bake-assets/validateIcons';
import { validateNodes } from '../../tools/bake-assets/validateNodes';
import { NODES } from '../../src/content/items/recipes';

const byId = (id: string): SpriteDef => SPRITES.find((s) => s.id === id) as SpriteDef;

describe('look-alike check', () => {
  it('fails two identical sprites and passes two different ones', () => {
    const a = byId('node.herb_patch');
    const twin: SpriteDef = { ...a, id: 'node.twin' };
    expect(pixelDistance(a, twin)).toBe(0);
    expect(lookAlikePairs([a], [twin]).map((p) => p.d)).toEqual([0]);
    expect(lookAlikePairs([a], [byId('node.silk_web')])).toEqual([]);
  });
});

describe('plant nodes (POW-M4-22E)', () => {
  it('no plant node uses an item icon, and none looks like decor', () => {
    expect(validateNodes(SPRITES)).toEqual([]);
    for (const n of Object.values(NODES))
      for (const id of Object.values(n.sprite))
        expect(id.startsWith('icon.') && !id.startsWith('icon.node_'), `${n.id} ${id}`).toBe(false);
  });
  it('the check catches a node that borrows an item icon', () => {
    const real = NODES['node.herb_patch']!;
    const saved = real.sprite;
    (real as { sprite: typeof saved }).sprite = { ready: 'icon.sunwort', spent: 'icon.moss_tuft' };
    try {
      expect(validateNodes(SPRITES).join()).toMatch(/item icon/);
    } finally {
      (real as { sprite: typeof saved }).sprite = saved;
    }
  });
});

describe('item icons (POW-M4-22F)', () => {
  it('every item has its own icon, its own name, and an icon unlike any other', () => {
    expect(validateItemIcons(SPRITES)).toEqual([]);
  });
  it('fails two identical icons, and names the pair', () => {
    const sunwort = byId('icon.sunwort');
    const sprites = SPRITES.map((s) => (s.id === 'icon.dewmint' ? { ...sunwort, id: s.id } : s));
    expect(validateItemIcons(sprites).join()).toMatch(
      /icon\.sunwort and icon\.dewmint look alike \(d = 0\.00/,
    );
  });
  it('a tier variant must differ in ramp as well as pixels', () => {
    const a = byId('icon.pick_copper');
    const b: SpriteDef = { ...a, id: 'icon.pick_iron' };
    const sprites = SPRITES.map((s) => (s.id === 'icon.pick_iron' ? b : s));
    expect(validateItemIcons(sprites).join()).toMatch(
      /pick_copper and icon.pick_iron differ by 0.00/,
    );
  });
});
