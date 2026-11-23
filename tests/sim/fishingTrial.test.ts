import { describe, expect, it } from 'vitest';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { emit } from '../../src/sim/kernel/events';
import { offerTrial, pointsOf, trialPassed, xpToNext } from '../../src/sim/skills';
import { createDemoState } from '../../src/sim/state';
import { trialsSystem } from '../../src/sim/systems/trials';

describe('the Fishing Trial at rank 14 (POW-M4-23B)', () => {
  it('is passed by three river fish, and the full bar then pays out to rank 15', () => {
    const s = createDemoState(21, 0);
    s.world = { solidAt: () => 0 };
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    const sk = s.entities.comps.skills[me]!;
    sk.points['skill.fishing'] = 14;
    sk.xp['skill.fishing'] = xpToNext(14);
    expect(offerTrial(s, me, 'trial.fishing.15')).toBe(true);
    for (let i = 0; i < 3; i++) {
      expect(trialPassed(sk, 'skill.fishing', 15)).toBe(false);
      s.tick++;
      s.events.list.length = 0;
      emit(s.events, {
        type: 'gathered',
        id: me,
        tag: 'fishing',
        item: 'item.fish_river',
        tier: 1,
        qty: 1,
      });
      trialsSystem(s);
    }
    expect(trialPassed(sk, 'skill.fishing', 15)).toBe(true);
    expect(pointsOf(s, me, 'skill.fishing')).toBeGreaterThanOrEqual(15);
  });
});
