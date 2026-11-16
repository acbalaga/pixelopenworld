import { DOLL_ORIGIN, type BodyType } from '../../dolls/parts';
import type { SpriteDef } from '../types';
import { Img, toSprite } from './img';

/**
 * Paper doll layer generator. Each layer is drawn on a 24x32 canvas with the recolorable slot
 * indices 4 to 7. Skin: 7 main, 6 shade, 5 deep. Cloth and hair: 5 main, 4 shade, 6 lit, 7 highlight.
 * Fixed colors avoid 4 to 7: 0 eyes, 1 belt and boots, 2 buckle. The outline is not drawn here:
 * it is generated from the composed silhouette so every combination gets a clean one.
 */
const SK = { main: 7, shade: 6, deep: 5 };
const CL = { main: 5, shade: 4, lit: 6, hi: 7 };
const EYE = 0;
const DARK = 1;
const BUCKLE = 2;

type Dir = 'down' | 'up' | 'right';
interface Pose {
  dir: Dir;
  bob: number;
  legDy: [number, number];
  armDy: [number, number];
  /** Profile only: arm swing and leg x positions (back, front). */
  armDx: number;
  legX: [number, number];
}

function poseOf(dir: Dir, step: number | 'idle'): Pose {
  const walking = step !== 'idle';
  return {
    dir,
    bob: step === 1 || step === 3 ? -1 : 0,
    legDy: step === 0 ? [1, -1] : step === 2 ? [-1, 1] : [0, 0],
    armDy: step === 0 ? [-1, 1] : step === 2 ? [1, -1] : [0, 0],
    armDx: !walking ? 0 : step === 0 ? -2 : step === 2 ? 2 : 0,
    legX: step === 0 ? [8, 14] : step === 2 ? [14, 8] : [10, 11],
  };
}

/** Body geometry. B is slimmer through shoulders, waist and legs. */
function geo(b: BodyType) {
  return b === 'a'
    ? {
        t0: 7,
        t1: 16,
        armL: 5,
        armR: 17,
        legs: [
          [7, 10],
          [13, 16],
        ] as const,
        pt0: 8,
        pt1: 15,
      }
    : {
        t0: 8,
        t1: 15,
        armL: 6,
        armR: 16,
        legs: [
          [8, 10],
          [13, 15],
        ] as const,
        pt0: 8,
        pt1: 15,
      };
}

function bodyLayer(b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const g = geo(b);
  const top = 5 + p.bob;
  if (p.dir !== 'right') {
    // head
    im.rect(7, top, 16, 13 + p.bob, SK.main);
    im.rect(15, top + 1, 16, 13 + p.bob, SK.shade);
    if (p.dir === 'down') {
      im.set(9, top + 4, EYE);
      im.set(14, top + 4, EYE);
      im.set(11, top + 6, SK.deep);
      im.set(12, top + 6, SK.deep);
      if (b === 'b') {
        im.set(8, top + 3, EYE);
        im.set(15, top + 3, EYE);
      }
    } else {
      im.rect(7, 13 + p.bob, 16, 13 + p.bob, SK.shade);
    }
    // torso, arms, legs
    im.rect(g.t0, 14 + p.bob, g.t1, 21 + p.bob, SK.main);
    im.rect(g.t1 - 1, 14 + p.bob, g.t1, 21 + p.bob, SK.shade);
    for (const [i, x0] of [g.armL, g.armR].entries()) {
      const dy = p.armDy[i as 0 | 1];
      im.rect(x0, 15 + p.bob + dy, x0 + 1, 21 + p.bob + dy, i === 0 ? SK.main : SK.shade);
    }
    for (const [i, [xa, xb]] of g.legs.entries()) {
      const dy = p.legDy[i as 0 | 1];
      im.rect(xa, 22 + p.bob, xb, 27 + dy, i === 0 ? SK.main : SK.shade);
    }
  } else {
    im.rect(8, top, 16, 13 + p.bob, SK.main);
    im.rect(15, top + 3, 16, 13 + p.bob, SK.shade);
    im.set(14, top + 4, EYE);
    im.set(17, top + 5, SK.main);
    im.rect(g.pt0, 14 + p.bob, g.pt1, 21 + p.bob, SK.main);
    im.rect(14, 14 + p.bob, 15, 21 + p.bob, SK.shade);
    const w = b === 'a' ? 4 : 3;
    for (const [i, x0] of p.legX.entries())
      im.rect(x0, 22 + p.bob, x0 + w - 1, 27, i === 0 ? SK.shade : SK.main);
    im.rect(10 + p.armDx, 15 + p.bob, 12 + p.armDx, 21 + p.bob, SK.main);
  }
  return im;
}

function bottomLayer(kind: 'trousers' | 'skirt', b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const g = geo(b);
  if (p.dir !== 'right') {
    if (kind === 'trousers') {
      for (const [i, [xa, xb]] of g.legs.entries()) {
        const dy = p.legDy[i as 0 | 1];
        im.rect(xa, 21 + p.bob, xb, 25 + dy, CL.main);
        im.rect(xa, 21 + p.bob, xa, 25 + dy, CL.lit);
        im.rect(xb - 1, 21 + p.bob, xb, 25 + dy, CL.shade);
        im.rect(xa, 26 + dy, xb, 27 + dy, DARK);
      }
      im.rect(g.t0, 20 + p.bob, g.t1, 21 + p.bob, CL.main);
    } else {
      const x0 = g.t0 - 1;
      const x1 = g.t1 + 1;
      im.rect(g.t0, 20 + p.bob, g.t1, 21 + p.bob, CL.main);
      im.rect(x0, 22 + p.bob, x1, 25 + p.bob, CL.main);
      im.rect(x0, 22 + p.bob, x0 + 1, 25 + p.bob, CL.lit);
      im.rect(x1 - 1, 22 + p.bob, x1, 25 + p.bob, CL.shade);
      im.rect(x0, 25 + p.bob, x1, 25 + p.bob, CL.shade);
      for (const [i, [xa, xb]] of g.legs.entries()) {
        const dy = p.legDy[i as 0 | 1];
        im.rect(xa, 26 + dy, xb, 27 + dy, DARK);
      }
    }
  } else if (kind === 'trousers') {
    const w = b === 'a' ? 4 : 3;
    for (const [i, x0] of p.legX.entries()) {
      im.rect(x0, 21 + p.bob, x0 + w - 1, 25, i === 0 ? CL.shade : CL.main);
      im.rect(x0, 26, x0 + w, 27, DARK);
    }
    im.rect(g.pt0, 20 + p.bob, g.pt1, 21 + p.bob, CL.main);
  } else {
    im.rect(g.pt0 - 1, 20 + p.bob, g.pt1 + 1, 25 + p.bob, CL.main);
    im.rect(g.pt0 - 1, 20 + p.bob, g.pt0, 25 + p.bob, CL.lit);
    im.rect(g.pt1, 20 + p.bob, g.pt1 + 1, 25 + p.bob, CL.shade);
    im.rect(g.pt0 - 1, 25 + p.bob, g.pt1 + 1, 25 + p.bob, CL.shade);
    for (const x0 of p.legX) im.rect(x0, 26, x0 + 3, 27, DARK);
  }
  return im;
}

function topLayer(kind: 'tunic' | 'vest', b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const g = geo(b);
  const beltY = 19 + p.bob;
  if (p.dir !== 'right') {
    im.rect(g.t0, 14 + p.bob, g.t1, 21 + p.bob, CL.main);
    im.rect(g.t0, 14 + p.bob, g.t0 + 1, 21 + p.bob, CL.lit);
    im.rect(g.t1 - 1, 14 + p.bob, g.t1, 21 + p.bob, CL.shade);
    im.rect(g.t0, 20 + p.bob, g.t1, 21 + p.bob, CL.shade);
    if (kind === 'tunic') {
      for (const [i, x0] of [g.armL, g.armR].entries()) {
        const dy = p.armDy[i as 0 | 1];
        im.rect(x0, 15 + p.bob + dy, x0 + 1, 19 + p.bob + dy, i === 0 ? CL.lit : CL.shade);
      }
      im.rect(g.t0, beltY, g.t1, beltY, DARK);
      im.set(11, beltY, BUCKLE);
      im.set(12, beltY, BUCKLE);
    } else {
      // vest: open at the neck, bare arms, short hem
      im.rect(g.t0, 21 + p.bob, g.t1, 21 + p.bob, null);
      if (p.dir === 'down') im.rect(10, 14 + p.bob, 13, 16 + p.bob, null);
      im.rect(g.t0 + 3, 17 + p.bob, g.t0 + 3, 19 + p.bob, DARK);
    }
  } else {
    im.rect(g.pt0, 14 + p.bob, g.pt1, 21 + p.bob, CL.main);
    im.rect(g.pt0, 14 + p.bob, g.pt0 + 1, 21 + p.bob, CL.lit);
    im.rect(g.pt1 - 1, 14 + p.bob, g.pt1, 21 + p.bob, CL.shade);
    im.rect(g.pt0, 20 + p.bob, g.pt1, 21 + p.bob, CL.shade);
    if (kind === 'tunic') {
      im.rect(10 + p.armDx, 15 + p.bob, 12 + p.armDx, 19 + p.bob, CL.lit);
      im.rect(g.pt0, beltY, g.pt1, beltY, DARK);
    } else {
      im.rect(g.pt0, 21 + p.bob, g.pt1, 21 + p.bob, null);
    }
  }
  return im;
}

type HairKind = 'short' | 'long' | 'ponytail' | 'curly' | 'bun';
function hairLayer(kind: HairKind, p: Pose): Img {
  const im = new Img(24, 32);
  const top = 5 + p.bob;
  const bottom = 13 + p.bob;
  if (p.dir !== 'right') {
    const back = p.dir === 'up';
    const cap = back ? bottom - 1 : top + 2;
    im.rect(7, top, 16, cap, CL.main);
    im.rect(7, top, 16, top, CL.lit);
    im.rect(15, top + 1, 16, cap, CL.shade);
    if (!back) {
      im.rect(7, top, 7, top + 4, CL.main);
      im.rect(16, top, 16, top + 4, CL.shade);
    }
    if (kind === 'long') {
      const to = 19 + p.bob;
      im.rect(6, top + 2, 7, to, CL.main);
      im.rect(16, top + 2, 17, to, CL.shade);
      if (back) im.rect(7, bottom, 16, to, CL.main);
      if (back) im.rect(15, bottom, 16, to, CL.shade);
    } else if (kind === 'curly') {
      im.rect(6, top - 1, 17, top + 5, CL.main);
      im.rect(6, top - 1, 17, top - 1, CL.lit);
      im.rect(16, top, 17, top + 5, CL.shade);
      if (back) im.rect(6, top, 17, bottom, CL.main);
      if (back) im.rect(16, top, 17, bottom, CL.shade);
      for (const [x, y] of [
        [8, top + 1],
        [12, top],
        [14, top + 2],
        [9, top + 4],
      ] as const)
        im.set(x, y, CL.lit);
    } else if (kind === 'ponytail') {
      if (back) {
        im.rect(11, bottom - 1, 12, 17 + p.bob, CL.main);
        im.rect(12, bottom, 12, 17 + p.bob, CL.shade);
      } else {
        im.rect(17, top + 3, 17, top + 7, CL.shade);
      }
    } else if (kind === 'bun') {
      im.rect(10, top - 2, 13, top - 1, CL.main);
      im.rect(10, top - 2, 11, top - 2, CL.lit);
    }
  } else {
    im.rect(8, top, 16, top + 2, CL.main);
    im.rect(8, top, 16, top, CL.lit);
    im.rect(8, top, 10, top + 7, CL.main);
    im.rect(8, top + 7, 9, top + 8, CL.shade);
    if (kind === 'long') im.rect(7, top + 2, 10, 19 + p.bob, CL.main);
    else if (kind === 'curly') {
      im.rect(7, top - 1, 15, top + 3, CL.main);
      im.rect(7, top - 1, 15, top - 1, CL.lit);
      im.rect(7, top, 11, top + 7, CL.main);
    } else if (kind === 'ponytail') {
      im.rect(6, top + 3, 7, top + 9, CL.shade);
      im.rect(7, top + 2, 7, top + 3, CL.main);
    } else if (kind === 'bun') {
      im.rect(9, top - 2, 12, top - 1, CL.main);
    }
  }
  return im;
}

const POSES: { name: string; pose: Pose }[] = [
  ...(['down', 'up', 'right'] as const).flatMap((d) =>
    [0, 1, 2, 3].map((n) => ({ name: `walk_${d}_${n}`, pose: poseOf(d, n) })),
  ),
  ...(['down', 'up', 'right'] as const).map((d) => ({
    name: `idle_${d}`,
    pose: poseOf(d, 'idle'),
  })),
];

function frames(draw: (p: Pose) => Img): Record<string, Img> {
  const out: Record<string, Img> = {};
  for (const { name, pose } of POSES) out[name] = draw(pose);
  return out;
}

const anims = {
  walk_down: { frames: ['walk_down_0', 'walk_down_1', 'walk_down_2', 'walk_down_3'], fps: 8 },
  walk_up: { frames: ['walk_up_0', 'walk_up_1', 'walk_up_2', 'walk_up_3'], fps: 8 },
  walk_right: { frames: ['walk_right_0', 'walk_right_1', 'walk_right_2', 'walk_right_3'], fps: 8 },
  walk_left: {
    frames: ['walk_right_0', 'walk_right_1', 'walk_right_2', 'walk_right_3'],
    fps: 8,
    flipX: true,
  },
  idle_down: { frames: ['idle_down', 'walk_down_1'], fps: 2 },
  idle_up: { frames: ['idle_up', 'walk_up_1'], fps: 2 },
  idle_right: { frames: ['idle_right', 'walk_right_1'], fps: 2 },
  idle_left: { frames: ['idle_right', 'walk_right_1'], fps: 2, flipX: true },
} as const;

function layer(id: string, draw: (p: Pose) => Img): SpriteDef {
  return toSprite(id, 'core', DOLL_ORIGIN, frames(draw), anims);
}

/** Every doll layer sprite. */
export function dollLayers(): SpriteDef[] {
  const out: SpriteDef[] = [];
  for (const b of ['a', 'b'] as const) {
    out.push(layer(`doll.body_${b}`, (p) => bodyLayer(b, p)));
    for (const k of ['trousers', 'skirt'] as const)
      out.push(layer(`doll.bottom_${k}_${b}`, (p) => bottomLayer(k, b, p)));
    for (const k of ['tunic', 'vest'] as const)
      out.push(layer(`doll.top_${k}_${b}`, (p) => topLayer(k, b, p)));
  }
  for (const k of ['short', 'long', 'ponytail', 'curly', 'bun'] as const)
    out.push(layer(`doll.hair_${k}`, (p) => hairLayer(k, p)));
  return out;
}
