import { describe, expect, it } from 'vitest';
import { BOSSES } from '../../src/content/creatures/bosses';
import { CALLOUT_STRINGS } from '../../src/content/strings/callouts';
import { CombatFeedback } from '../../src/render/feedback';
import type { SimState } from '../../src/sim/state';
import { calloutFor } from '../../src/ui/combat/callout';

const AVATAR = 1;
const BOSS = 7;
const PLAIN = 9;
const bramble = BOSSES['boss.old_bramblehide'] ?? Object.values(BOSSES).find((b) => b.callouts);
/** Just the parts `calloutFor` reads. */
const state = {
  entities: {
    comps: {
      combatant: {
        [BOSS]: { kind: bramble!.creature },
        [PLAIN]: { kind: 'creature.mossling' },
      },
    },
  },
} as unknown as SimState;

describe('callouts (POW-M5-22)', () => {
  it("shout the avatar's own technique by name", () => {
    expect(
      calloutFor(state, AVATAR, {
        type: 'techniqueUsed',
        who: AVATAR,
        technique: 'technique.blades_lunge',
      }),
    ).toEqual({ id: AVATAR, text: 'Lunge', boss: false });
  });

  it("do not shout someone else's technique", () => {
    expect(
      calloutFor(state, AVATAR, {
        type: 'techniqueUsed',
        who: 4,
        technique: 'technique.blades_lunge',
      }),
    ).toBeNull();
  });

  it("shout a boss's signature move, and not its plain attacks or a common creature's", () => {
    const [attack, key] = Object.entries(bramble!.callouts!)[0]!;
    expect(calloutFor(state, AVATAR, { type: 'attackStarted', id: BOSS, attack })).toEqual({
      id: BOSS,
      text: CALLOUT_STRINGS[key],
      boss: true,
    });
    expect(
      calloutFor(state, AVATAR, { type: 'attackStarted', id: BOSS, attack: 'attack.not_a_move' }),
    ).toBeNull();
    expect(calloutFor(state, AVATAR, { type: 'attackStarted', id: PLAIN, attack })).toBeNull();
  });

  it('every boss callout names a move in its own pattern and a string that exists', () => {
    let n = 0;
    for (const b of Object.values(BOSSES))
      for (const [attack, key] of Object.entries(b.callouts ?? {})) {
        const used = b.phases.some((p) => p.pattern.some((s) => s.attack === attack));
        expect(used, `${b.id} ${attack}`).toBe(true);
        expect(CALLOUT_STRINGS[key], key).toBeTruthy();
        expect(CALLOUT_STRINGS[key]!.length, key).toBeLessThanOrEqual(16);
        n++;
      }
    expect(n).toBeGreaterThanOrEqual(7);
  });

  it('one shout per entity at a time, gone after its time', () => {
    const f = new CombatFeedback({ hit: '#fff', crit: '#ff0', hurt: '#f00' });
    f.callout(AVATAR, 'Lunge', '#ff0', 0);
    f.callout(AVATAR, 'Crosscut', '#ff0', 100);
    expect(f.activeCallouts(200)).toEqual([{ id: AVATAR, text: 'Crosscut' }]);
    expect(f.activeCallouts(5_000)).toEqual([]);
  });
});
