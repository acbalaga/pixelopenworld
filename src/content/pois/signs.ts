import { SIGN_STRINGS } from '../strings/signs';
import type { FixtureDef } from '../world/fixtures';
import { DAWNMEADOW_POIS } from './dawnmeadow';

/**
 * The readable signs of Dawnmeadow (regions/01-dawnmeadow, owner feedback after M4). A sign is a
 * fixture you use from the front: the text shows as a notice. Gate, milestone, tree shrine and
 * edge signs stand inside their stamps (they place `fixture.sign_<id>` themselves); the rest are
 * placed by the region spec from this list.
 */
export interface SignDef {
  id: string;
  x: number;
  y: number;
}

/** A sign's fixture kind. */
export const signKind = (id: string): string => `fixture.sign_${id}`;

/** Every sign id, so the strings and fixtures can be checked against each other. */
export const SIGN_IDS: readonly string[] = Object.keys(SIGN_STRINGS).map((k) =>
  k.replace(/^sign\./, ''),
);

/** The vista signs stand on their lookout's top left plus (2, 0). */
const vista = (poi: string): SignDef => {
  const p = DAWNMEADOW_POIS.find((x) => x.id === `poi.${poi}`);
  if (!p?.stamp) throw new Error(`no vista ${poi}`);
  return { id: poi, x: p.stamp.x + 2, y: p.stamp.y };
};

/** Signs the region spec places (the others are in their stamps). */
export const PLACED_SIGNS: readonly SignDef[] = [
  vista('windmill_hill'),
  vista('sea_cliffs'),
  vista('crane_top'),
  vista('lark_spring'),
  vista('delta_lookout'),
  { id: 'millbrook', x: 280, y: 126 },
  { id: 'reedmouth', x: 292, y: 242 },
  { id: 'stonecrop', x: 176, y: 60 },
];

export const SIGN_FIXTURES: readonly FixtureDef[] = SIGN_IDS.map((id) => ({
  kind: signKind(id),
  type: 'sign' as const,
  sprite: 'prop.sign',
  size: 10,
}));
