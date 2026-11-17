import { describe, expect, it } from 'vitest';
import { hapticFor, sfxFor } from '../../src/platform/combatFx';
import { SFX } from '../../src/content/audio/sfx';
import { CombatFeedback } from '../../src/render/feedback';
import type { SimEvent } from '../../src/sim/kernel/events';

const hit = (over: Partial<Extract<SimEvent, { type: 'damageDealt' }>> = {}): SimEvent => ({
  type: 'damageDealt',
  src: 0,
  dst: 1,
  amount: 9,
  crit: false,
  bonus: false,
  heavy: false,
  tag: 'blades',
  ...over,
});
const colors = { hit: '#fff', crit: '#ff0', hurt: '#f00' };

describe('sound and haptics from events', () => {
  it('every sound it names exists in the effect content', () => {
    const ids = new Set(SFX.map((s) => s.id));
    const events: SimEvent[] = [
      hit(),
      hit({ heavy: true }),
      { type: 'perfectDodge', id: 0, src: 1 },
      { type: 'dodgeStarted', id: 0 },
      { type: 'denied', id: 0, reason: 'stamina' },
      { type: 'echoRecovered', id: 3, coin: 5 },
      { type: 'died', id: 1, team: 1 },
      { type: 'staggerBreak', id: 1 },
    ];
    for (const e of events) {
      const s = sfxFor(e, 0);
      expect(s, e.type).not.toBeNull();
      expect(ids.has(s as string), s as string).toBe(true);
    }
  });
  it('heavy hits sound heavier, and only the player hears their own denials', () => {
    expect(sfxFor(hit(), 0)).toBe('sfx.hit_light');
    expect(sfxFor(hit({ crit: true }), 0)).toBe('sfx.hit_heavy');
    expect(sfxFor({ type: 'denied', id: 5, reason: 'stamina' }, 0)).toBeNull();
  });
  it('taking a hit buzzes longer than landing one, and perfect dodge has its own pattern', () => {
    expect(hapticFor(hit({ dst: 0 }), 0)).toBe(25);
    expect(hapticFor(hit({ dst: 1 }), 0)).toBe(8);
    expect(Array.isArray(hapticFor({ type: 'perfectDodge', id: 0, src: 1 }, 0))).toBe(true);
    expect(hapticFor({ type: 'died', id: 1, team: 1 }, 0)).toBeNull();
  });
});

describe('CombatFeedback', () => {
  const pos = () => ({ x: 10, y: 10 });
  it('flashes whoever was hit, briefly', () => {
    const f = new CombatFeedback(colors);
    f.onEvents([hit()], 1000, pos, 0, false);
    let on = false;
    for (let t = 1000; t < 1160; t += 10) on = on || f.flashing(1, t);
    expect(on).toBe(true);
    expect(f.flashing(1, 1400)).toBe(false);
    expect(f.flashing(2, 1000)).toBe(false);
  });
  it('shakes on heavy hits and hits taken, and not at all under reduced motion', () => {
    const a = new CombatFeedback(colors);
    a.onEvents([hit({ heavy: true })], 1000, pos, 0, false);
    const moved = [0, 16, 32, 48].some((d) => {
      const s = a.shake(1000 + d);
      return s.x !== 0 || s.y !== 0;
    });
    expect(moved).toBe(true);
    expect(a.shake(1500)).toEqual({ x: 0, y: 0 });
    const b = new CombatFeedback(colors);
    b.onEvents([hit({ heavy: true }), hit({ dst: 0 })], 1000, pos, 0, true);
    for (const d of [0, 16, 32, 48]) expect(b.shake(1000 + d)).toEqual({ x: 0, y: 0 });
  });
  it('a light hit on an enemy does not shake', () => {
    const f = new CombatFeedback(colors);
    f.onEvents([hit()], 1000, pos, 0, false);
    expect(f.shake(1010)).toEqual({ x: 0, y: 0 });
  });
});
