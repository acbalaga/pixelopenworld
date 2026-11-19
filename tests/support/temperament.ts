import { afterAll, beforeAll } from 'vitest';
import { CREATURES } from '../../src/content/creatures';
import type { CreatureDef } from '../../src/content/creatures/types';

/** A copy of a creature without the named optional fields. */
export function without(def: CreatureDef, ...keys: (keyof CreatureDef)[]): CreatureDef {
  const copy: Record<string, unknown> = { ...def };
  for (const k of keys) delete copy[k];
  return copy as unknown as CreatureDef;
}

/**
 * Makes the named creatures hostile for one test file or block, so tests of generic chase and
 * shoot mechanics do not depend on the shipped temperament. Temperament rules have their own tests.
 */
export function hostileCreatures(...ids: string[]): void {
  const saved = new Map<string, CreatureDef>();
  beforeAll(() => {
    const all = CREATURES as Record<string, CreatureDef>;
    for (const id of ids) {
      const def = all[id] as CreatureDef;
      saved.set(id, def);
      all[id] = { ...without(def, 'night'), temperament: 'hostile' };
    }
  });
  afterAll(() => {
    const all = CREATURES as Record<string, CreatureDef>;
    for (const [id, def] of saved) all[id] = def;
  });
}
