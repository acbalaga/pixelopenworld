import { NODES } from '../../src/content/items/recipes';
import type { SpriteDef } from '../../src/content/sprites/types';
import { lookAlikePairs } from './lookalike';

/**
 * Gatherable plants are drawn as plants (POW-M4-22E). No node uses an item icon, except the
 * veins, trees and fishing spots, which have their own world art under `icon.node_`. And no node
 * looks like a bush or flower that is only decor.
 */
export function validateNodes(sprites: readonly SpriteDef[]): string[] {
  const errors: string[] = [];
  const byId = new Map(sprites.map((s) => [s.id, s]));
  const ready: SpriteDef[] = [];
  for (const n of Object.values(NODES)) {
    for (const [frame, id] of Object.entries(n.sprite)) {
      if (id.startsWith('icon.') && !id.startsWith('icon.node_'))
        errors.push(`node ${n.id} ${frame}: sprite ${id} is an item icon, draw it as a plant`);
      if (!byId.has(id)) errors.push(`node ${n.id} ${frame}: sprite ${id} does not exist`);
    }
    const r = byId.get(n.sprite.ready);
    if (r && !n.sprite.ready.startsWith('icon.')) ready.push(r);
  }
  const decor = sprites.filter((s) => /^prop\.(bush|flower)_/.test(s.id));
  for (const p of lookAlikePairs(ready, decor))
    errors.push(`node ${p.a} looks like decor ${p.b} (d = ${p.d.toFixed(2)}, needs 0.20)`);
  return errors;
}
