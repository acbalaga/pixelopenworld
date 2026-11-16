import { describe, expect, it } from 'vitest';
import { SFX } from '../../src/content/audio/sfx';
import { ATTACKS } from '../../src/content/combat/attacks';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { minTelegraphMs, minTelegraphTicks } from '../../src/content/creatures/rules';
import type { CreatureDef } from '../../src/content/creatures/types';
import { SPRITES } from '../../src/content/sprites';
import { validateCreatures, type ContentRefs } from '../../tools/bake-assets/validateCreatures';

const refs: ContentRefs = {
  attacks: ATTACKS,
  sprites: new Set(SPRITES.map((s) => s.id)),
  sfx: new Set(SFX.map((s) => s.id)),
};
const mossling = CREATURES['creature.mossling']!;
const check = (c: CreatureDef): string[] => validateCreatures({ [c.id]: c }, {}, refs);

describe('creature content', () => {
  it('all shipped creatures and spawners are valid', () => {
    expect(validateCreatures(CREATURES, SPAWNERS, refs)).toEqual([]);
  });

  it('has the three archetypes and a miniboss with a phase', () => {
    const kinds = new Set(Object.values(CREATURES).map((c) => c.archetype));
    expect([...kinds].sort()).toEqual(['charger', 'chaser', 'shooter']);
    expect(CREATURES['creature.old_bramblehide']?.phases?.length).toBeGreaterThan(0);
  });

  it('every creature sprite has the animations the renderer asks for, in four facings', () => {
    const byId = new Map(SPRITES.map((s) => [s.id, s]));
    for (const c of Object.values(CREATURES)) {
      const s = byId.get(c.sprite)!;
      for (const f of ['down', 'up', 'left', 'right'])
        for (const a of ['idle', 'attack', 'hurt'])
          expect(s.anims?.[`${a}_${f}`], `${c.id} ${a}_${f}`).toBeDefined();
      if (c.speed > 0) expect(s.anims?.walk_down, `${c.id} walk`).toBeDefined();
    }
  });

  it('the minimum telegraph is 350 ms at tier 1 and tightens to 200 ms at tier 8', () => {
    expect(minTelegraphMs(1)).toBe(350);
    expect(minTelegraphMs(8)).toBe(200);
    expect(minTelegraphMs(4)).toBeLessThan(minTelegraphMs(3));
    expect(minTelegraphTicks(1)).toBe(11);
  });

  it('no attack in the creature data telegraphs under the tier minimum', () => {
    for (const c of Object.values(CREATURES))
      for (const a of c.attacks)
        expect(
          (ATTACKS[a.attack]!.windup * 1000) / 30,
          `${c.id} ${a.attack}`,
        ).toBeGreaterThanOrEqual(minTelegraphMs(c.tier));
  });
});

describe('creature validation catches mistakes', () => {
  it('a too-short telegraph is an error naming the creature and the attack', () => {
    const fast = {
      ...refs,
      attacks: { ...ATTACKS, 'attack.fast': { ...ATTACKS['attack.creature_swipe']!, windup: 6 } },
    };
    const bad = { ...mossling, attacks: [{ attack: 'attack.fast', range: 20, cooldown: 30 }] };
    const errors = validateCreatures({ [bad.id]: bad }, {}, fast);
    expect(errors.join('\n')).toMatch(
      /creature.mossling: attack attack.fast telegraphs 6 ticks \(200 ms\)/,
    );
  });
  it('unknown sprite, attack, sound and spawner creature are errors', () => {
    expect(check({ ...mossling, sprite: 'creature.nope' }).join()).toMatch(/sprite creature.nope/);
    expect(
      check({ ...mossling, attacks: [{ attack: 'attack.nope', range: 10, cooldown: 1 }] }).join(),
    ).toMatch(/attack.nope does not exist/);
    expect(
      check({ ...mossling, sounds: { notice: 'sfx.nope', die: 'sfx.creature_die' } }).join(),
    ).toMatch(/sfx.nope/);
    expect(
      validateCreatures(
        {},
        {
          'spawner.x': {
            kind: 'spawner.x',
            creature: 'creature.nope',
            cap: 1,
            respawn: 10,
            radius: 1,
          },
        },
        refs,
      ).join(),
    ).toMatch(/creature.nope does not exist/);
  });
  it('archetype rules: a shooter needs a projectile, a charger a dash, only shooters stand still', () => {
    expect(
      check({ ...mossling, archetype: 'shooter', keepRange: { min: 0, max: 50 } }).join(),
    ).toMatch(/projectile/);
    expect(check({ ...mossling, archetype: 'charger' }).join()).toMatch(/dash/);
    expect(check({ ...mossling, speed: 0 }).join()).toMatch(/only a shooter/);
  });
  it('phases must fall and attacks cannot need a phase the creature lacks', () => {
    const boss = CREATURES['creature.old_bramblehide']!;
    expect(
      check({
        ...boss,
        phases: [
          { hpPct: 50, speedPct: 120 },
          { hpPct: 60, speedPct: 130 },
        ],
      }).join(),
    ).toMatch(/must fall/);
    expect(check({ ...boss, phases: [] }).join()).toMatch(/needs phase 1/);
  });
  it('drops with min above max are errors', () => {
    expect(
      check({ ...mossling, drops: [{ item: 'item.coin', chance: 50, min: 3, max: 1 }] }).join(),
    ).toMatch(/min 3 above max 1/);
  });
});
