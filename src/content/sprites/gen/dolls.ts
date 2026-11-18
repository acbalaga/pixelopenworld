import {
  DOLL_ANIMS,
  DOLL_DRAWN_DIRS,
  DOLL_ORIGIN,
  WORK_ANIMS,
  type BodyType,
  type WorkAnim,
} from '../../dolls/parts';
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
  /** What the arms are doing. Held items read it to pick their angle. */
  stance: 'rest' | 'windup' | 'strike' | 'recover' | 'hurt' | 'dodge';
  /** Whole figure shift in px, applied to every layer alike so they stay registered. */
  shiftX: number;
  shiftY: number;
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
    stance: 'rest',
    shiftX: 0,
    shiftY: 0,
  };
}

type Action = 'attack' | 'hurt' | 'dodge';

/** Poses for attack (3 frames), hurt (1) and dodge (2). `toward` is the way the figure lunges. */
function actionPose(dir: Dir, action: Action, n: number): Pose {
  const side = dir === 'right';
  const toward = dir === 'up' ? -1 : 1;
  const p = poseOf(dir, 'idle');
  if (action === 'attack') {
    p.stance = (['windup', 'strike', 'recover'] as const)[n] ?? 'rest';
    if (side) {
      p.armDx = [-3, 4, 1][n] ?? 0;
      p.legX = [9, 13];
      p.shiftX = n === 1 ? 1 : 0;
    } else {
      p.armDy = [
        [0, -4],
        [0, 3],
        [0, 1],
      ][n] as [number, number];
      p.legDy = [0, 0];
      p.shiftY = n === 1 ? toward : 0;
    }
  } else if (action === 'hurt') {
    p.stance = 'hurt';
    if (side) {
      p.armDx = -2;
      p.legX = [8, 14];
      p.shiftX = -2;
    } else {
      p.armDy = [-2, -2];
      p.legDy = [1, -1];
      p.shiftY = -toward;
    }
  } else {
    p.stance = 'dodge';
    p.bob = n === 0 ? 2 : 3;
    p.legX = [8, 14];
    p.armDy = [-1, -1];
    if (side) {
      p.armDx = -2;
      p.shiftX = n === 0 ? 1 : 3;
    } else p.shiftY = n === 0 ? 0 : toward;
  }
  return p;
}

/**
 * Poses for the four frames of a work animation. Held items read `stance`, so a swing reuses the
 * attack stances and the rest stay at rest with the arms doing the work.
 */
function workPose(dir: Dir, work: WorkAnim, n: number): Pose {
  const side = dir === 'right';
  const toward = dir === 'up' ? -1 : 1;
  const p = poseOf(dir, 'idle');
  switch (work) {
    case 'work_swing': {
      const a = actionPose(dir, 'attack', n < 3 ? n : 0);
      return n < 3 ? a : p;
    }
    case 'work_reach':
      p.bob = n === 1 || n === 2 ? 1 : 0;
      if (side) {
        p.armDx = [0, 3, 3, 1][n] as number;
        p.shiftX = n === 1 || n === 2 ? 1 : 0;
      } else {
        p.armDy = [
          [0, 0],
          [2, 2],
          [2, 2],
          [0, 1],
        ][n] as [number, number];
        p.shiftY = n === 1 || n === 2 ? toward : 0;
      }
      return p;
    case 'work_stir':
      if (side) p.armDx = [-1, 2, 1, -2][n] as number;
      else
        p.armDy = [
          [-1, 0],
          [0, -1],
          [1, 0],
          [0, 1],
        ][n] as [number, number];
      p.bob = n === 1 ? -1 : 0;
      return p;
    case 'work_hands':
      p.stance = n % 2 === 0 ? 'rest' : 'windup';
      if (side) p.armDx = [0, 2, 0, 2][n] as number;
      else p.armDy = n % 2 === 0 ? [-2, -2] : [1, 1];
      p.bob = n % 2 === 0 ? 0 : 1;
      return p;
    case 'work_cast':
      p.stance = (['windup', 'strike', 'recover', 'rest'] as const)[n] ?? 'rest';
      if (side) {
        p.armDx = [-3, 4, 3, 3][n] as number;
        p.legX = [9, 13];
      } else
        p.armDy = [
          [0, -4],
          [0, 3],
          [0, 2],
          [0, 2],
        ][n] as [number, number];
      return p;
  }
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
          [8, 10],
          [13, 15],
        ] as const,
        pt0: 8,
        pt1: 16,
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
    const w = 3;
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
      const x0 = g.t0;
      const x1 = g.t1;
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
    const w = 3;
    for (const [i, x0] of p.legX.entries()) {
      im.rect(x0, 21 + p.bob, x0 + w - 1, 25, i === 0 ? CL.shade : CL.main);
      im.rect(x0, 26, x0 + w, 27, DARK);
    }
    im.rect(g.pt0, 20 + p.bob, g.pt1, 21 + p.bob, CL.main);
  } else {
    im.rect(g.pt0, 20 + p.bob, g.pt1, 25 + p.bob, CL.main);
    im.rect(g.pt0, 20 + p.bob, g.pt0 + 1, 25 + p.bob, CL.lit);
    im.rect(g.pt1 - 1, 20 + p.bob, g.pt1, 25 + p.bob, CL.shade);
    im.rect(g.pt0, 25 + p.bob, g.pt1, 25 + p.bob, CL.shade);
    for (const x0 of p.legX) im.rect(x0, 26, x0 + 3, 27, DARK);
  }
  return im;
}

function topLayer(kind: 'tunic' | 'vest' | 'robe', b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const g = geo(b);
  const beltY = 19 + p.bob;
  if (p.dir !== 'right') {
    im.rect(g.t0, 14 + p.bob, g.t1, 21 + p.bob, CL.main);
    im.rect(g.t0, 14 + p.bob, g.t0 + 1, 21 + p.bob, CL.lit);
    im.rect(g.t1 - 1, 14 + p.bob, g.t1, 21 + p.bob, CL.shade);
    im.rect(g.t0, 20 + p.bob, g.t1, 21 + p.bob, CL.shade);
    if (kind === 'tunic' || kind === 'robe') {
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
    if (kind === 'tunic' || kind === 'robe') {
      im.rect(10 + p.armDx, 15 + p.bob, 12 + p.armDx, 19 + p.bob, CL.lit);
      im.rect(g.pt0, beltY, g.pt1, beltY, DARK);
    } else {
      im.rect(g.pt0, 21 + p.bob, g.pt1, 21 + p.bob, null);
    }
  }
  if (kind === 'robe') robeSkirt(im, b, p);
  return im;
}

/** The robe's long skirt: flares from the waist to just above the boots. */
function robeSkirt(im: Img, b: BodyType, p: Pose): void {
  const g = geo(b);
  const x0 = p.dir === 'right' ? g.pt0 : g.t0;
  const x1 = p.dir === 'right' ? g.pt1 : g.t1;
  const top = 22 + p.bob;
  const bottom = Math.max(top, 25);
  im.rect(x0, top, x1, bottom, CL.main);
  im.rect(x0, top, x0 + 1, bottom, CL.lit);
  im.rect(x1 - 1, top, x1, bottom, CL.shade);
  im.rect(x0, bottom, x1, bottom, CL.shade);
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

// Item colors are fixed palette entries: 28 to 31 metal, 44 to 47 ochre wood, 26 and 27 violet, 17 and 18 stone, 22 ember.
const METAL = { edge: 29, blade: 30, tip: 31 };
const WOOD = { shade: 44, main: 45, lit: 46 };

/** Where the hands are. Down and up views show both arms, the profile shows the near arm. */
function hands(b: BodyType, p: Pose): { main: [number, number]; off: [number, number] } {
  const g = geo(b);
  const raised = p.armDy[1] <= -2;
  if (p.dir === 'right') {
    const y = (p.stance === 'strike' ? 18 : 20) + p.bob;
    return { main: [12 + p.armDx, y], off: [g.pt0 - 2, 18 + p.bob] };
  }
  return {
    main: [g.armR, (raised ? 15 : 21) + p.bob + p.armDy[1]],
    off: [g.armL, 21 + p.bob + p.armDy[0]],
  };
}

function swordLayer(b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const [hx, hy] = hands(b, p).main;
  const side = p.dir === 'right';
  const cx = side ? hx + 1 : hx + 2;
  const up = p.stance === 'windup' || (p.stance === 'hurt' && !side);
  im.rect(cx - 1, hy, cx + 1, hy, 2);
  const blade = (x: number, y: number, last: boolean): void =>
    im.set(x, y, last ? METAL.tip : METAL.blade);
  if (side && p.stance === 'strike') {
    for (let i = 1; i <= 7; i++) blade(cx + i, hy, i === 7);
    im.rect(cx + 1, hy + 1, cx + 6, hy + 1, METAL.edge);
  } else if (side && p.stance === 'recover') {
    for (let i = 1; i <= 5; i++) blade(cx + i, hy + i - 1, i === 5);
  } else if (up) {
    for (let i = 1; i <= 7; i++) blade(cx, hy - i, i === 7);
  } else {
    for (let i = 1; i <= 7; i++) blade(cx, hy + i, i === 7);
    im.rect(cx + 1, hy + 2, cx + 1, hy + 6, METAL.edge);
  }
  return im;
}

function staffLayer(b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const [hx, hy] = hands(b, p).main;
  const cx = p.dir === 'right' ? hx + 1 : hx + 2;
  im.rect(cx, hy - 7, cx, hy + 3, WOOD.main);
  im.rect(cx, hy - 3, cx, hy - 1, WOOD.lit);
  im.rect(cx, hy + 1, cx, hy + 3, WOOD.shade);
  im.rect(cx - 1, hy - 9, cx + 1, hy - 8, 26);
  im.set(cx, hy - 8, 27);
  return im;
}

/**
 * A spear: a long wooden shaft with a leaf-shaped steel head. Held low and tilted at rest, drawn
 * back along the arm in the windup, thrust out at full length on the strike, and drawn in again
 * on the recover. Pose rules follow the sword's so the figure and the haft read as one motion.
 */
function spearLayer(b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const [hx, hy] = hands(b, p).main;
  const side = p.dir === 'right';
  const cx = side ? hx + 1 : hx + 2;
  /** Shaft pixels from (x0,y0) to (x1,y1), one pixel thick, lit and shaded in runs. */
  const shaft = (x0: number, y0: number, x1: number, y1: number): void => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n));
      const y = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n));
      im.set(x, y, i % 4 === 1 ? WOOD.lit : i % 4 === 3 ? WOOD.shade : WOOD.main);
    }
  };
  /** Head pointing along (dx,dy), a unit step on one axis. Tip is the last pixel. */
  const head = (x: number, y: number, dx: number, dy: number): void => {
    // Ferrule band, then a three pixel blade, then the tip.
    im.set(x, y, METAL.edge);
    const px = (i: number): [number, number] => [x + dx * i, y + dy * i];
    const wide = (i: number, w: number): void => {
      const [bx, by] = px(i);
      for (let k = -w; k <= w; k++)
        im.set(
          bx + (dx === 0 ? k : 0),
          by + (dy === 0 ? k : 0),
          k === 0 ? METAL.blade : METAL.edge,
        );
    };
    wide(1, 1);
    wide(2, 1);
    const [tx, ty] = px(3);
    im.set(tx, ty, METAL.tip);
  };
  if (side) {
    if (p.stance === 'windup') {
      shaft(cx - 9, hy + 1, cx - 2, hy);
      head(cx - 1, hy, 1, 0);
    } else if (p.stance === 'strike') {
      shaft(cx - 10, hy, cx + 1, hy);
      head(cx + 2, hy, 1, 0);
    } else if (p.stance === 'recover') {
      shaft(cx - 8, hy + 1, cx, hy);
      head(cx + 1, hy, 1, 0);
    } else {
      // Carried: shaft slanting up and forward, head high over the shoulder.
      shaft(cx - 1, hy + 5, cx + 1, hy - 7);
      head(cx + 1, hy - 8, 0, -1);
    }
    return im;
  }
  const dir = p.dir === 'up' ? -1 : 1;
  if (p.stance === 'strike') {
    // Thrust along the view axis: toward the viewer going down, away going up.
    // The head stays inside the canvas margin, so it is drawn closer going down than going up.
    if (dir > 0) {
      shaft(cx, hy - 7, cx, hy + 1);
      head(cx, hy + 2, 0, 1);
    } else {
      shaft(cx, hy + 3, cx, hy - 9);
      head(cx, hy - 10, 0, -1);
    }
  } else if (p.stance === 'windup') {
    // Drawn back: the head swings behind the hand.
    shaft(cx, hy + 6 * dir, cx, hy - 5 * dir);
    head(cx, hy - 6 * dir, 0, -dir);
  } else {
    shaft(cx, hy + 4, cx, hy - 7);
    head(cx, hy - 8, 0, -1);
  }
  return im;
}

/**
 * A maul: a stout haft with a square iron head. Carried head-up over the shoulder, hauled back on
 * the windup, brought down on the strike (toward the viewer going down, along the ground in profile).
 */
function maulLayer(b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const [hx, hy] = hands(b, p).main;
  const side = p.dir === 'right';
  const cx = side ? hx + 1 : hx + 2;
  const haft = (x0: number, y0: number, x1: number, y1: number): void => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n));
      const y = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n));
      im.set(x, y, i % 3 === 1 ? WOOD.lit : WOOD.main);
    }
  };
  /** The head: a 4 by 3 block of iron with a lit top edge. */
  const head = (x: number, y: number): void => {
    im.rect(x - 2, y - 1, x + 1, y + 1, METAL.blade);
    im.rect(x - 2, y - 1, x + 1, y - 1, METAL.tip);
    im.rect(x - 2, y + 1, x + 1, y + 1, METAL.edge);
  };
  if (side) {
    if (p.stance === 'windup') {
      haft(cx, hy, cx - 4, hy - 8);
      head(cx - 4, hy - 10);
    } else if (p.stance === 'strike') {
      haft(cx - 2, hy, cx + 5, hy);
      head(cx + 7, hy);
    } else if (p.stance === 'recover') {
      haft(cx, hy, cx + 3, hy + 4);
      head(cx + 4, hy + 6);
    } else {
      haft(cx, hy + 3, cx + 1, hy - 7);
      head(cx + 1, hy - 9);
    }
    return im;
  }
  if (p.stance === 'strike') {
    haft(cx, hy - 6, cx, hy + 2);
    head(cx, hy + 4);
  } else if (p.stance === 'windup') {
    haft(cx, hy + 2, cx, hy - 8);
    head(cx, hy - 10);
  } else {
    haft(cx, hy + 3, cx, hy - 7);
    head(cx, hy - 9);
  }
  return im;
}

/**
 * A short bow: a wooden arc with a pale string. At rest it hangs at the side. On the windup the
 * archer draws (string pulled to the cheek), on the strike it is held out, loosed.
 */
function bowLayer(b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const [hx, hy] = hands(b, p).main;
  const side = p.dir === 'right';
  const cx = side ? hx + 1 : hx + 2;
  const drawn = p.stance === 'windup';
  const out = p.stance === 'strike';
  if (side) {
    const x = out ? cx + 5 : cx + 3;
    im.rect(x, hy - 5, x, hy + 5, WOOD.main);
    im.set(x - 1, hy - 5, WOOD.lit);
    im.set(x - 1, hy + 5, WOOD.shade);
    im.set(x + 1, hy - 4, WOOD.main);
    im.set(x + 1, hy + 4, WOOD.main);
    // String, pulled back toward the cheek when drawn.
    const sx = drawn ? x - 5 : x - 1;
    im.rect(sx, hy, sx, hy, 3);
    for (let i = 1; i <= 4; i++) {
      im.set(Math.round(x - (x - sx) * (1 - i / 5)), hy - 5 + Math.round(i * 1), 2);
      im.set(Math.round(x - (x - sx) * (1 - i / 5)), hy + 5 - Math.round(i * 1), 2);
    }
    return im;
  }
  // Facing the viewer or away: the bow stands upright beside the hand.
  const x = out ? cx + 1 : cx + 2;
  im.rect(x, hy - 7, x, hy + 3, WOOD.main);
  im.rect(x + 1, hy - 6, x + 1, hy - 5, WOOD.lit);
  im.rect(x + 1, hy + 1, x + 1, hy + 2, WOOD.shade);
  im.rect(x - 1, hy - 7, x - 1, hy + 3, 2);
  return im;
}

/** Wraps: cloth bound round the knuckles, with the end of the strap trailing on a strike. */
function wrapsLayer(b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const [hx, hy] = hands(b, p).main;
  const side = p.dir === 'right';
  const cx = side ? hx + 1 : hx + 2;
  const reach = p.stance === 'strike' ? 3 : 0;
  im.rect(cx - 1 + reach, hy - 1, cx + 1 + reach, hy + 1, 3);
  im.rect(cx - 1 + reach, hy + 1, cx + 1 + reach, hy + 1, 2);
  im.set(cx + reach, hy - 1, 31);
  if (p.stance === 'strike') im.rect(cx - 3, hy + 1, cx - 2, hy + 2, 2);
  if (!side) {
    // The other hand, on the off arm, so both fists read as wrapped.
    const [ox, oy] = hands(b, p).off;
    im.rect(ox - 2, oy - 1, ox, oy + 1, 3);
    im.rect(ox - 2, oy + 1, ox, oy + 1, 2);
  }
  return im;
}

function shieldLayer(b: BodyType, p: Pose): Img {
  const im = new Img(24, 32);
  const [hx, hy] = hands(b, p).off;
  if (p.dir === 'right') {
    // Strapped to the far arm: only the rim shows behind the torso.
    im.rect(hx, hy - 3, hx + 1, hy + 3, METAL.edge);
    im.rect(hx, hy - 2, hx, hy + 2, 18);
  } else {
    im.rect(hx - 3, hy - 5, hx, hy, METAL.edge);
    im.rect(hx - 2, hy - 4, hx - 1, hy - 1, 18);
    im.set(hx - 2, hy - 3, 22);
  }
  return im;
}

function shifted(src: Img, dx: number, dy: number): Img {
  if (dx === 0 && dy === 0) return src;
  const out = new Img(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) out.set(x + dx, y + dy, src.get(x, y));
  return out;
}

const POSES: { name: string; pose: Pose }[] = [
  ...DOLL_DRAWN_DIRS.flatMap((d) =>
    [0, 1, 2, 3].map((n) => ({ name: `walk_${d}_${n}`, pose: poseOf(d, n) })),
  ),
  ...DOLL_DRAWN_DIRS.map((d) => ({ name: `idle_${d}`, pose: poseOf(d, 'idle') })),
  ...DOLL_DRAWN_DIRS.flatMap((d) =>
    [0, 1, 2].map((n) => ({ name: `attack_${d}_${n}`, pose: actionPose(d, 'attack', n) })),
  ),
  ...DOLL_DRAWN_DIRS.map((d) => ({ name: `hurt_${d}`, pose: actionPose(d, 'hurt', 0) })),
  ...DOLL_DRAWN_DIRS.flatMap((d) =>
    [0, 1].map((n) => ({ name: `dodge_${d}_${n}`, pose: actionPose(d, 'dodge', n) })),
  ),
  ...WORK_ANIMS.flatMap((w) =>
    DOLL_DRAWN_DIRS.flatMap((d) =>
      [0, 1, 2, 3].map((n) => ({ name: `${w}_${d}_${n}`, pose: workPose(d, w, n) })),
    ),
  ),
];

/**
 * Keeps held items inside the margin the composed outline needs (2 px from every canvas edge),
 * so a long blade at full reach is cut short instead of running off the frame.
 */
function clipped(src: Img): Img {
  const out = new Img(src.w, src.h);
  for (let y = 2; y < src.h - 2; y++)
    for (let x = 2; x < src.w - 2; x++) out.set(x, y, src.get(x, y));
  return out;
}

function frames(draw: (p: Pose) => Img, clip: boolean): Record<string, Img> {
  const out: Record<string, Img> = {};
  for (const { name, pose } of POSES) {
    const img = shifted(draw(pose), pose.shiftX, pose.shiftY);
    out[name] = clip ? clipped(img) : img;
  }
  return out;
}

function layer(id: string, draw: (p: Pose) => Img, clip = false): SpriteDef {
  return toSprite(id, 'core', DOLL_ORIGIN, frames(draw, clip), DOLL_ANIMS);
}

/** Every doll layer sprite. */
export function dollLayers(): SpriteDef[] {
  const out: SpriteDef[] = [];
  for (const b of ['a', 'b'] as const) {
    out.push(layer(`doll.body_${b}`, (p) => bodyLayer(b, p)));
    for (const k of ['trousers', 'skirt'] as const)
      out.push(layer(`doll.bottom_${k}_${b}`, (p) => bottomLayer(k, b, p)));
    for (const k of ['tunic', 'vest', 'robe'] as const)
      out.push(layer(`doll.top_${k}_${b}`, (p) => topLayer(k, b, p)));
    out.push(layer(`doll.main_sword_${b}`, (p) => swordLayer(b, p), true));
    out.push(layer(`doll.main_staff_${b}`, (p) => staffLayer(b, p), true));
    out.push(layer(`doll.main_spear_${b}`, (p) => spearLayer(b, p), true));
    out.push(layer(`doll.main_maul_${b}`, (p) => maulLayer(b, p), true));
    out.push(layer(`doll.main_bow_${b}`, (p) => bowLayer(b, p), true));
    out.push(layer(`doll.main_wraps_${b}`, (p) => wrapsLayer(b, p), true));
    out.push(layer(`doll.off_shield_${b}`, (p) => shieldLayer(b, p), true));
  }
  for (const k of ['short', 'long', 'ponytail', 'curly', 'bun'] as const)
    out.push(layer(`doll.hair_${k}`, (p) => hairLayer(k, p)));
  return out;
}
