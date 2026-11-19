import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../../src/content/combat/attacks';
import { SFX } from '../../src/content/audio/sfx';
import { CREATURES } from '../../src/content/creatures';
import { DAWNMEADOW_CREATURES } from '../../src/content/creatures/dawnmeadow';
import { minTelegraphTicks } from '../../src/content/creatures/rules';
import type { Archetype, Temperament } from '../../src/content/creatures/types';
import { ITEMS } from '../../src/content/items';
import { SPRITES } from '../../src/content/sprites';
import { sfxFor } from '../../src/platform/combatFx';

/** regions/01-dawnmeadow section 3: id, day temperament, night temperament, archetype. */
const DOC: [string, Temperament, Temperament | undefined, Archetype][] = [
  ['meadow_hare', 'skittish', undefined, 'chaser'],
  ['hedge_sparrow', 'skittish', undefined, 'flyer'],
  ['moor_wisp', 'curious', undefined, 'flyer'],
  ['downs_ram', 'defensive', undefined, 'chaser'],
  ['grain_rat', 'hostile', undefined, 'swarm'],
  ['fox', 'curious', 'hostile', 'skirmisher'],
  ['strawman', 'hostile', undefined, 'guard'],
  ['burrow_mole', 'defensive', undefined, 'burrower'],
  ['thistle_wasp', 'territorial', undefined, 'flyer'],
  ['barrow_bones', 'hostile', undefined, 'chaser'],
  ['reed_crab', 'defensive', undefined, 'guard'],
  ['marsh_leech', 'hostile', undefined, 'chaser'],
  ['rubblet', 'territorial', undefined, 'guard'],
  ['crag_hawk', 'territorial', undefined, 'flyer'],
  ['moorhound', 'hostile', undefined, 'chaser'],
  ['thornling_scout', 'hostile', undefined, 'skirmisher'],
  ['hollowhorn', 'territorial', undefined, 'charger'],
];

describe('Dawnmeadow roster', () => {
  it('has the 17 new creatures of the region doc, and with the three before them 20 distinct', () => {
    expect(Object.keys(DAWNMEADOW_CREATURES)).toHaveLength(17);
    for (const [id] of DOC) expect(CREATURES[`creature.${id}`], id).toBeDefined();
    const tier1 = ['creature.mossling', 'creature.spitbloom', 'creature.bramble_boar'];
    for (const id of tier1) expect(CREATURES[id]?.tier).toBe(1);
    expect(new Set([...tier1, ...Object.keys(DAWNMEADOW_CREATURES)]).size).toBe(20);
  });

  it.each(DOC)(
    '%s has the temperament, night temperament and archetype the doc names',
    (id, day, night, arch) => {
      const c = CREATURES[`creature.${id}`]!;
      expect(c.temperament).toBe(day);
      expect(c.night).toBe(night);
      expect(c.archetype).toBe(arch);
    },
  );

  it('packs, territories and tethers are where the doc and design/04 put them', () => {
    const c = (id: string) => CREATURES[`creature.${id}`]!;
    for (const id of ['downs_ram', 'grain_rat', 'moorhound', 'hedge_sparrow'])
      expect(c(id).pack, id).toBeDefined();
    for (const id of ['thistle_wasp', 'rubblet', 'crag_hawk', 'hollowhorn'])
      expect(c(id).territory?.warnTicks, id).toBeGreaterThanOrEqual(30);
    for (const id of ['strawman', 'reed_crab', 'rubblet']) expect(c(id).tether, id).toBeDefined();
    // The visitor is a tier 2 creature, and Hollowhorn is the one with phases.
    expect(c('thornling_scout').tier).toBe(2);
    expect(c('hollowhorn').phases?.length).toBeGreaterThan(0);
  });

  it('every attack telegraphs at least the tier minimum, and every drop is a real item', () => {
    for (const c of Object.values(DAWNMEADOW_CREATURES)) {
      for (const a of c.attacks) {
        const def = ATTACKS[a.attack];
        expect(def, `${c.id} ${a.attack}`).toBeDefined();
        expect(def!.windup, `${c.id} ${a.attack}`).toBeGreaterThanOrEqual(
          minTelegraphTicks(c.tier),
        );
      }
      for (const d of c.drops) expect(ITEMS[d.item], `${c.id} ${d.item}`).toBeDefined();
    }
  });

  it('every creature has a sprite and its own notice and die sounds', () => {
    const sprites = new Set(SPRITES.map((s) => s.id));
    const sfx = new Set(SFX.map((s) => s.id));
    for (const c of Object.values(DAWNMEADOW_CREATURES)) {
      expect(sprites.has(c.sprite), c.id).toBe(true);
      expect(sfx.has(c.sounds.notice), c.id).toBe(true);
      expect(sfx.has(c.sounds.die), c.id).toBe(true);
    }
  });

  it('a creature plays its own voice when it notices and when it dies, and the default otherwise', () => {
    const voice = (id: number) => (id === 7 ? CREATURES['creature.crag_hawk']!.sounds : undefined);
    expect(sfxFor({ type: 'noticed', id: 7, target: 0 }, 0, voice)).toBe('sfx.screech_notice');
    expect(sfxFor({ type: 'died', id: 7, team: 1 }, 0, voice)).toBe('sfx.screech_die');
    expect(sfxFor({ type: 'noticed', id: 8, target: 0 }, 0, voice)).toBe('sfx.creature_notice');
    expect(sfxFor({ type: 'died', id: 8, team: 1 }, 0)).toBe('sfx.creature_die');
  });

  it('the roster ranks by toughness the way the zones do: small prey under the Mossling par', () => {
    const par = CREATURES['creature.mossling']!.hp;
    for (const id of ['meadow_hare', 'hedge_sparrow', 'grain_rat', 'thistle_wasp'])
      expect(CREATURES[`creature.${id}`]!.hp, id).toBeLessThan(par / 2);
    expect(CREATURES['creature.hollowhorn']!.hp).toBeGreaterThan(par * 5);
  });
});
