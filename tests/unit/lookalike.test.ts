import { describe, expect, it } from 'vitest';
import { SPRITES } from '../../src/content/sprites';
import type { SpriteDef } from '../../src/content/sprites/types';
import { lookAlikePairs, pixelDistance } from '../../tools/bake-assets/lookalike';
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
