/**
 * The way west (POW-M4-11, regions/01-dawnmeadow section 7). Whisperwood is built in M8, so the
 * three ways out of Dawnmeadow (the Thornwall Pass, the Fernside climb and the badger tunnels) end
 * at one closed yard on the region's far west edge, reached only by their portals. M8 replaces its
 * far wall with the road. Nothing on foot leads in.
 */
import type { FixtureDef } from '../fixtures';

/** The landing yard's top left and size, in region tiles. */
export const LANDING = { x: 2, y: 146, w: 16, h: 14, stamp: 'whisperwood_edge' } as const;

/** Where each route's portal stands in the yard (region tiles). */
export const LANDING_SPOTS = {
  tunnel: { x: 6, y: 152 },
  climb: { x: 10, y: 152 },
  pass: { x: 14, y: 152 },
} as const;

/** The top of the Fernside climb: its stamp stands at (46, 100), its route at x 49 to 51. */
export const CLIMB_TOP = { x: 50, y: 101 } as const;

const portal = (
  kind: string,
  to: string,
  at: { x: number; y: number },
  arrive: readonly [number, number],
): FixtureDef => ({ kind, type: 'portal', to, arrive, at });

/** The three bells on the walls of Thornwall Pass, to be rung in order (their order is carved in the keep). */
export const BELL_ORDER: readonly number[] = [2, 3, 1];

/** The climb's top portal and its landing end. The tunnels' end is the back door of m2. */
export const WEST_FIXTURES: readonly FixtureDef[] = [
  ...bellList(),
  portal('fixture.fc_top', 'fixture.wl_climb', CLIMB_TOP, [0, 24]),
  portal('fixture.wl_climb', 'fixture.fc_top', LANDING_SPOTS.climb, [0, 24]),
];

function bellList(): FixtureDef[] {
  return [1, 2, 3].map((n) => ({
    kind: `fixture.tw_bell_${n}`,
    type: 'switch' as const,
    sprite: 'prop.plate',
    size: 12,
    bell: { group: 'thornwall', order: BELL_ORDER.indexOf(n) + 1 },
  }));
}
