import { describe, expect, it } from 'vitest';
import { randomDoll } from '../../src/content/dolls/parts';
import { dollWithGear } from '../../src/render/gearDoll';

describe('equipment on the paper doll', () => {
  it('changes the paper doll layers', () => {
    const base = randomDoll(() => 0.3);
    const none = { main: null, off: null, head: null, body: null, legs: null, accessory: null };
    expect(dollWithGear(base, none)).toMatchObject({ mainHand: 'none', offHand: 'none' });
    const worn = dollWithGear(base, {
      ...none,
      main: { item: 'item.sword_iron' },
      off: { item: 'item.shield_wood' },
      body: { item: 'item.outfit_scholar' },
    });
    expect(worn).toMatchObject({
      mainHand: 'sword',
      offHand: 'shield',
      top: 'robe',
      topColor: 'violet',
      skin: base.skin,
    });
    expect(dollWithGear(base, { ...none, body: { item: 'item.outfit_leather' } })).toMatchObject({
      top: 'vest',
      topColor: 'brown',
    });
  });
});
