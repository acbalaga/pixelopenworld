import type { FixtureDef } from '../world/fixtures';

/**
 * Places the region's requests send people to (POW-M4-11): a torn page lying at each of four
 * points of interest for Wren's Missing Pages, a clock in the bell tower that wants tinkering, and
 * the downs by the Shepherd's Barrow at night. Region tiles.
 */
export const PAGE_SITES: readonly { id: string; x: number; y: number }[] = [
  { id: 'cart', x: 258, y: 195 },
  { id: 'tower', x: 140, y: 140 },
  { id: 'barn', x: 251, y: 100 },
  { id: 'camp', x: 339, y: 140 },
];

export const REQUEST_VIGILS: readonly { kind: string; x: number; y: number }[] = [
  { kind: 'fixture.req_clock', x: 188, y: 177 },
  { kind: 'fixture.req_barrow', x: 126, y: 303 },
];

export const REQUEST_FIXTURES: readonly FixtureDef[] = [
  ...PAGE_SITES.map((p): FixtureDef => ({
    kind: `fixture.page_${p.id}`,
    type: 'chest',
    sprite: 'prop.chest',
    size: 12,
    loot: { items: [{ item: 'item.wren_page', qty: 1 }] },
  })),
  // The tower clock: tinker with it (Tinkering 5 is enough to see what is wrong).
  {
    kind: 'fixture.req_clock',
    type: 'vigil',
    secret: { radius: 30, flag: 'request.clock', need: { skill: 'skill.tinkering', points: 5 } },
  },
  // The lights on the downs show after dark: be at the barrow then.
  {
    kind: 'fixture.req_barrow',
    type: 'vigil',
    secret: { radius: 70, flag: 'request.barrow_lights', phases: ['night'] },
  },
];
