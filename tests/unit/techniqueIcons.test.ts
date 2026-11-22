import { describe, expect, it } from 'vitest';
import { TECHNIQUES } from '../../src/content/combat/techniques';
import { UI_ICONS } from '../../src/content/sprites/ui/icons';

describe('technique button icons (G4 playtest)', () => {
  const actives = Object.values(TECHNIQUES).filter((t) => t.kind === 'active');

  it('gives every active technique its own icon, so swapping one for another changes the button', () => {
    const seen = new Map<string, string>();
    for (const t of actives) {
      const other = seen.get(t.icon);
      expect(other, `${t.id} shares ${t.icon} with ${other}`).toBeUndefined();
      seen.set(t.icon, t.id);
    }
  });

  it('draws every icon a technique names', () => {
    const drawn = new Set(UI_ICONS.map((s) => s.id));
    for (const t of actives) expect(drawn.has(t.icon), `${t.id}: ${t.icon}`).toBe(true);
  });
});
