import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/platform/input/layout';
import { InputSampler } from '../../src/platform/input/sampler';
import { TouchController } from '../../src/platform/input/touch';

/**
 * A sheet that opens over the canvas swallows the finger-up, so the touch stick and a held button
 * would stay down behind it and the avatar would keep pushing into whatever it faced (POW-M5-23,
 * the NPC beside the dummy). `releaseAll` lets go of every finger at once.
 */
describe('releasing input when a panel opens', () => {
  it('stops a stick that was dragged and never lifted', () => {
    const touch = new TouchController(computeLayout(360, 800, false));
    const sampler = new InputSampler(touch);
    touch.down(1, 100, 600, 0);
    touch.move(1, 170, 600);
    expect(sampler.sample(33).moveDir).not.toBeNull();
    sampler.releaseAll();
    const rec = sampler.sample(66);
    expect(rec.moveDir).toBeNull();
    expect(rec.move).toEqual({ x: 0, y: 0 });
    // A finger that lifts late, over the sheet or not, changes nothing.
    touch.up(1, 170, 600, 100);
    expect(sampler.sample(133).moveDir).toBeNull();
  });

  it('drops a held button and any edge event waiting', () => {
    const layout = computeLayout(360, 800, false);
    const touch = new TouchController(layout);
    const sampler = new InputSampler(touch);
    const b = layout.buttons.context;
    const at = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    touch.down(7, at.x, at.y, 0);
    // Held past the hold time: it counts as held.
    expect(touch.sample(1000).buttonsHeld.size).toBeGreaterThan(0);
    sampler.releaseAll();
    expect(touch.sample(1100).buttonsHeld.size).toBe(0);
    expect(touch.sample(1100).buttonsDown.size).toBe(0);
  });

  it('keeps a finger that lands after the release working', () => {
    const touch = new TouchController(computeLayout(360, 800, false));
    const sampler = new InputSampler(touch);
    sampler.releaseAll();
    touch.down(2, 100, 600, 0);
    touch.move(2, 170, 600);
    expect(sampler.sample(33).moveDir).not.toBeNull();
  });
});
