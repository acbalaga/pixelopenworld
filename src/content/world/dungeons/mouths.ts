/**
 * Where each mini-dungeon opens in the world (POW-M4-11): the stamp that marks it, its top left, and
 * the region tile of the portal on it. Found once on the baked map (open ground with a free ring)
 * and kept as data.
 */
import { MOUTH_PORTAL } from '../stamps/mouths';

export interface MouthSite {
  /** The stamp that marks it. Absent when a stamp of its own (the town's yard) holds the hatch. */
  stamp?: string;
  x: number;
  y: number;
  /** The region tile of the portal. */
  portal: { x: number; y: number };
}

const site = (stamp: string, x: number, y: number): MouthSite => ({
  stamp,
  x,
  y,
  portal: { x: x + MOUTH_PORTAL.x, y: y + MOUTH_PORTAL.y },
});

export const MOUTHS: Readonly<Record<string, MouthSite>> = {
  // In the inn yard, on the planks laid for it in the town's stamp.
  m1: { x: 179, y: 215, portal: { x: 179, y: 215 } },
  m2: site('dg_mouth_arch', 88, 195),
  m3: site('dg_mouth_tower', 133, 177),
  m5: site('dg_mouth_hatch', 175, 271),
  m6: site('dg_mouth_arch', 305, 149),
  m7: site('dg_mouth_arch', 169, 291),
  m10: site('dg_mouth_tomb', 125, 301),
  m4: site('dg_mouth_arch', 313, 266),
  m8: site('dg_mouth_arch', 199, 60),
  m9: site('dg_mouth_arch', 25, 87),
  m12: site('dg_mouth_tower', 227, 41),
  m11: site('dg_mouth_arch', 204, 294),
};
