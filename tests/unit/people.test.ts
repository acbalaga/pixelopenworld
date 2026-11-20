import { describe, expect, it } from 'vitest';
import { TIME, WEATHER } from '../../src/content/balance/time';
import { DIALOGUES, NPCS } from '../../src/content/dialogue';
import { ITEMS } from '../../src/content/items';
import { FOUL, PEOPLE, PLACES } from '../../src/content/people';
import { DIALOGUE_STRINGS } from '../../src/content/strings/dialogue';
import { STAMPS } from '../../src/content/world/stamps';
import { TOWN_PARTS } from '../../src/content/world/stamps/hearthford';
import { placeOf, whereIs } from '../../src/sim/people';

const DAY_PHASES = TIME.phases.map((p) => p.phase);

// The stamps build their layout lists when the library is read.
void STAMPS;

const NAMES = [
  'Brin',
  'Tobin',
  'Mara',
  'Ilse',
  'Hesper',
  'Orla',
  'Wren',
  'Pilgrim',
  'Pell',
  'Juniper',
  'Aldo',
  'Tamsin',
  'Nessa',
  'Garrick',
  'Old Fen',
  'Edda',
];

describe('the people of Dawnmeadow (M4-12)', () => {
  it('are the sixteen of regions/01 section 9, each a real NPC with something to say', () => {
    const people = Object.values(PEOPLE);
    expect(people).toHaveLength(16);
    expect(people.map((p) => NPCS[p.npc]?.name).sort()).toEqual([...NAMES].sort());
    for (const p of people) {
      expect(DIALOGUES[p.npc], p.npc).toBeDefined();
      expect(p.role.length, p.npc).toBeGreaterThan(2);
    }
  });

  it('keep the ids of the M3 givers, and give every new person a greeting with no em dash', () => {
    for (const id of [
      'shopkeeper',
      'smith',
      'outfitter',
      'herbalist',
      'scholar',
      'guard',
      'cook',
      'pilgrim',
    ])
      expect(PEOPLE[`npc.${id}`], id).toBeDefined();
    for (const id of [
      'carpenter',
      'tinker',
      'miller',
      'farmer',
      'fisher',
      'foreman',
      'hermit',
      'reeve',
    ]) {
      const line = DIALOGUE_STRINGS[`dlg.${id}.greet`];
      expect(line, id).toBeTruthy();
      expect(line, id).not.toMatch(/[—–]/);
    }
  });

  it('live and work in places that exist, and Hearthford places are parts of its layout', () => {
    const parts = new Set(TOWN_PARTS.map((p) => p.id));
    for (const place of Object.values(PLACES))
      if (place.part) expect(parts.has(place.part), place.id).toBe(true);
    for (const p of Object.values(PEOPLE)) {
      expect(PLACES[p.home], `${p.npc} home`).toBeDefined();
      expect(PLACES[p.work], `${p.npc} work`).toBeDefined();
      for (const s of p.schedule) expect(PLACES[s.place], `${p.npc} ${s.place}`).toBeDefined();
    }
  });

  it('have a slot for every phase in every weather, so none falls back to home by accident', () => {
    for (const p of Object.values(PEOPLE))
      for (const phase of DAY_PHASES)
        for (const w of WEATHER)
          expect(
            p.schedule.some(
              (s) => s.phases.includes(phase) && (!s.weather || s.weather.includes(w)),
            ),
            `${p.npc} ${phase} ${w}`,
          ).toBe(true);
  });

  it('go indoors in foul weather, except the guard on the gate', () => {
    for (const p of Object.values(PEOPLE)) {
      if (p.npc === 'npc.guard') continue;
      for (const phase of DAY_PHASES)
        for (const w of FOUL)
          expect(PLACES[placeOf(p, phase, w)]!.indoors, `${p.npc} ${phase} ${w}`).toBe(true);
    }
  });

  it('keep to the hours the region doc names', () => {
    // The Pilgrim: the square by day, the chapel at night.
    expect(whereIs('npc.pilgrim', 'day', 'clear')).toBe('hearthford.square');
    expect(whereIs('npc.pilgrim', 'night', 'clear')).toBe('wayside.chapel');
    expect(whereIs('npc.pilgrim', 'day', 'rain')).toBe('hearthford.inn');
    // Workers are at work by day and home by night.
    expect(whereIs('npc.fisher', 'day', 'clear')).toBe('reedmouth.jetty');
    expect(whereIs('npc.fisher', 'day', 'rain')).toBe('reedmouth.hut');
    expect(whereIs('npc.fisher', 'night', 'clear')).toBe('reedmouth.hut');
    expect(whereIs('npc.foreman', 'day', 'clear')).toBe('stonecrop.quarry');
    expect(whereIs('npc.hermit', 'day', 'clear')).toBe('cairnmoor.well');
    expect(whereIs('npc.hermit', 'night', 'clear')).toBe('cairnmoor.shelter');
    expect(whereIs('npc.reeve', 'day', 'clear')).toBe('hearthford.square');
    expect(whereIs('npc.smith', 'dusk', 'clear')).toBe('hearthford.inn');
    // The shopkeeper and the innkeeper never leave their counters.
    for (const phase of DAY_PHASES) {
      expect(whereIs('npc.shopkeeper', phase, 'clear')).toBe('hearthford.brin_shop');
      expect(whereIs('npc.cook', phase, 'rain')).toBe('hearthford.inn');
    }
    expect(whereIs('npc.nobody', 'day', 'clear')).toBeNull();
  });

  it('like up to three real items each', () => {
    for (const p of Object.values(PEOPLE)) {
      expect(p.likes.length, p.npc).toBeGreaterThan(0);
      expect(p.likes.length, p.npc).toBeLessThanOrEqual(3);
      for (const it of p.likes) expect(ITEMS[it], `${p.npc} ${it}`).toBeDefined();
    }
  });
});
