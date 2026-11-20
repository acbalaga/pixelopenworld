import type { SpriteDef } from '../types';
import { Img, shadedEllipse, type Tones4 } from './img';
import { sprite, type Maker, type Pose } from './creatures';

/**
 * Dawnmeadow's creatures (POW-M4-05): a few parametric shapes, each drawn once per pose and look,
 * like the Mossling and the boars. Four legged animals, birds and wasps, a wisp, a crab, a leech
 * and the standing figures. The same rules hold: light from the top left, a 1 px outline added
 * to every frame, no more than three tones a material.
 */

const WOOD: Tones4 = [4, 5, 6, 7];
const STONE: Tones4 = [16, 17, 18, 19];
const FIRE: Tones4 = [20, 21, 22, 23];
const METAL: Tones4 = [28, 29, 30, 31];
const FUR_RUST: Tones4 = [32, 33, 34, 35];
const ROSE: Tones4 = [40, 41, 42, 43];
const STRAW: Tones4 = [44, 45, 46, 47];
const BONE: Tones4 = [1, 2, 3, 3];
const WATER: Tones4 = [12, 13, 14, 15];

type Ears = 'long' | 'point' | 'round' | 'none';
type Horns = 'ram' | 'antler' | 'none';
type Tail = 'bush' | 'short' | 'long' | 'none';

interface QuadLook {
  size: number;
  body: Tones4;
  snout: number;
  eye: number;
  ears: Ears;
  horns: Horns;
  tail: Tail;
  /** A pale chest and tail tip. */
  pale?: number;
  /** Slimmer body and legs (hounds, hares). */
  lean?: boolean;
}

/** A four legged animal. Side view is the main drawing; front and back are narrower. */
function quadMaker(id: string, look: QuadLook): Maker {
  const k = look.size / 16;
  const s = (n: number): number => Math.round(n * k);
  const size = look.size;
  const lean = look.lean ? 0.85 : 1;
  return {
    id,
    size,
    origin: [size / 2, Math.round(size - 2 * k - 2)],
    walks: true,
    draw(p: Pose) {
      const im = new Img(size, size);
      const cy = size - s(7) - p.bob - (p.rear ? 1 : 0);
      // Side view sits left of centre so the head and a lunge stay inside the canvas.
      const cx = size / 2 + (p.view === 'right' ? Math.round(p.lunge * k * 0.5) - s(2) : 0);
      const lift = (i: number): number =>
        p.step < 0 ? 0 : (p.step + i) % 2 === 0 ? Math.max(1, Math.round(k)) : 0;
      const eye = p.hurt ? 0 : look.eye;
      const leg = (x: number, i: number): void =>
        void im.rect(
          x,
          cy + s(2.5) - lift(i),
          x + Math.max(0, s(1) - 1),
          cy + s(5) - lift(i),
          look.body[0],
        );
      if (p.view === 'right') {
        for (const [dx, i] of [
          [-4.5, 0],
          [-2.5, 1],
          [2.5, 1],
          [4.5, 0],
        ] as const)
          leg(Math.round(cx + s(dx)), i);
        // Tail first, behind the body.
        const tx = Math.round(cx - s(5));
        if (look.tail === 'bush') {
          shadedEllipse(im, tx, cy - s(3), s(2.6), s(2.6), look.body);
          if (look.pale) im.rect(tx - s(2), cy - s(5), tx - s(1), cy - s(4), look.pale);
        } else if (look.tail === 'long') im.rect(tx - s(2), cy - s(2), tx, cy - s(2), look.body[1]);
        else if (look.tail === 'short')
          im.rect(tx - s(1), cy - s(2), tx, cy - s(1), look.pale ?? look.body[3]);
        shadedEllipse(im, cx, cy, s(5.6), s(4 * lean) + p.stretch * 0.5, look.body);
        if (look.pale)
          shadedEllipse(im, cx + s(1.5), cy + s(2), s(2.2), s(1.2), [
            look.pale,
            look.pale,
            look.pale,
            look.pale,
          ]);
        // Head.
        const hx = Math.round(cx + s(5));
        const hy = cy - s(2) + (p.rear ? s(1.5) : 0);
        shadedEllipse(im, hx, hy, s(3), s(2.7), look.body);
        im.rect(hx + s(2), hy, hx + s(3), hy + s(1.5), look.snout);
        im.set(hx + s(3), hy, 0);
        if (p.open) im.rect(hx + s(2), hy + s(2), hx + s(3), hy + s(2), 20);
        im.set(hx + s(0.5), hy - s(1), eye);
        // Ears and horns.
        if (look.ears === 'long') im.rect(hx - s(1), hy - s(6), hx, hy - s(2), look.body[2]);
        else if (look.ears === 'point') {
          im.rect(hx - s(1), hy - s(4), hx, hy - s(3), look.body[2]);
          im.set(hx - s(1), hy - s(5), look.body[3]);
        } else if (look.ears === 'round')
          shadedEllipse(im, hx - s(1), hy - s(3), s(1.2), s(1.2), look.body);
        if (look.horns === 'ram') {
          shadedEllipse(im, hx - s(1), hy - s(1), s(2), s(2.4), METAL);
          im.rect(hx - s(1), hy - s(1), hx, hy, look.body[1]);
        } else if (look.horns === 'antler') {
          const ax = hx - s(1);
          im.rect(ax, hy - s(8), ax + 1, hy - s(3), WOOD[3]);
          im.rect(ax + s(2), hy - s(7), ax + s(2) + 1, hy - s(6), WOOD[3]);
          im.rect(ax - s(2), hy - s(6), ax - s(1) + 1, hy - s(5), WOOD[3]);
          im.rect(ax + s(1), hy - s(10), ax + s(1) + 1, hy - s(8), WOOD[3]);
        }
      } else {
        const w = s(5 * lean);
        leg(Math.round(cx) - s(3.5), 0);
        leg(Math.round(cx) + s(2.5), 1);
        const lunge = p.view === 'down' ? Math.max(0, p.lunge) : 0;
        if (p.view === 'up' && look.tail !== 'none')
          shadedEllipse(
            im,
            cx,
            cy + s(3),
            look.tail === 'bush' ? s(2.6) : s(1.2),
            look.tail === 'bush' ? s(2.6) : s(1.4),
            look.body,
          );
        shadedEllipse(im, cx, cy + lunge, w, s(4.6) + p.stretch * 0.5, look.body);
        if (p.view === 'down') {
          if (look.pale)
            shadedEllipse(im, cx, cy + s(2) + lunge, s(2.4), s(1.8), [
              look.pale,
              look.pale,
              look.pale,
              look.pale,
            ]);
          // The head, forward and a little above the body.
          shadedEllipse(im, cx, cy - s(2) + lunge, s(3.2), s(2.8), look.body);
          im.rect(Math.round(cx) - 1, cy - s(1) + lunge, Math.round(cx), cy + lunge, look.snout);
          im.set(Math.round(cx) - 1, cy + lunge, 0);
          im.set(Math.round(cx) - s(2), cy - s(2.5) + lunge, eye);
          im.set(Math.round(cx) + s(2) - 1, cy - s(2.5) + lunge, eye);
          if (p.open)
            im.rect(Math.round(cx) - 1, cy + 1 + lunge, Math.round(cx), cy + 2 + lunge, 20);
        }
        const hx = Math.round(cx);
        const hy = cy - s(4) + lunge;
        if (look.ears === 'long') {
          im.rect(hx - s(2), hy - s(4), hx - s(1), hy, look.body[2]);
          im.rect(hx + s(1), hy - s(4), hx + s(2), hy, look.body[2]);
        } else if (look.ears === 'point') {
          im.rect(hx - s(2), hy - s(2), hx - s(1), hy, look.body[2]);
          im.rect(hx + s(1), hy - s(2), hx + s(2), hy, look.body[2]);
        } else if (look.ears === 'round') {
          im.rect(hx - s(3), hy - s(1), hx - s(2), hy, look.body[2]);
          im.rect(hx + s(2), hy - s(1), hx + s(3), hy, look.body[2]);
        }
        if (look.horns === 'ram') {
          im.rect(hx - s(4), hy, hx - s(3), hy + s(2), METAL[2]);
          im.rect(hx + s(3), hy, hx + s(4), hy + s(2), METAL[2]);
          im.rect(hx - s(4), hy - 1, hx - s(3), hy - 1, METAL[3]);
          im.rect(hx + s(3), hy - 1, hx + s(4), hy - 1, METAL[3]);
        } else if (look.horns === 'antler') {
          for (const sx of [-1, 1]) {
            const ax = hx + sx * s(3);
            im.rect(ax, hy - s(7), ax, hy, WOOD[3]);
            im.rect(ax + sx * s(1), hy - s(6), ax + sx * s(2), hy - s(6), WOOD[3]);
            im.rect(ax + sx * s(1), hy - s(3), ax + sx * s(2), hy - s(3), WOOD[3]);
          }
        }
      }
      return im;
    },
  };
}

interface BirdLook {
  size: number;
  body: Tones4;
  wing: Tones4;
  beak: number;
  /** A wasp: striped, with a sting, and four thin wings. */
  wasp?: boolean;
  crest?: boolean;
}

/** A bird or a wasp, hovering. Wings beat with the walk step and the idle bob. */
function birdMaker(id: string, look: BirdLook): Maker {
  const size = look.size;
  const k = size / 16;
  const s = (n: number): number => Math.round(n * k);
  return {
    id,
    size,
    origin: [size / 2, size - 3],
    walks: true,
    draw(p: Pose) {
      const im = new Img(size, size);
      const flap = p.step < 0 ? p.bob : p.step % 2;
      const cx = size / 2 + (p.view === 'right' ? Math.round(p.lunge / 2) : 0);
      const cy = size - s(7) - p.bob - (p.rear ? 1 : 0);
      const eye = p.hurt ? 0 : 3;
      // Wings behind the body, up on the flap.
      const wingUp = flap === 1 ? -s(2) : 0;
      if (p.view === 'right') {
        shadedEllipse(im, cx - s(1), cy - s(2) + wingUp, s(3.5), s(1.6), look.wing);
        if (look.wasp)
          shadedEllipse(im, cx - s(3), cy - s(3) + wingUp, s(2.6), s(1.2), [14, 15, 15, 15]);
      } else {
        shadedEllipse(im, cx - s(5), cy - s(1) + wingUp, s(3), s(1.6), look.wing);
        shadedEllipse(im, cx + s(5), cy - s(1) + wingUp, s(3), s(1.6), look.wing);
      }
      if (look.wasp) {
        // Striped abdomen behind a small thorax and head.
        const ab = p.view === 'right' ? [cx - s(3), cy + s(1)] : [cx, cy + s(2)];
        shadedEllipse(im, ab[0] as number, ab[1] as number, s(3), s(2.4), look.body);
        for (let i = -1; i <= 1; i++) {
          const bx = Math.round(ab[0] as number) + (p.view === 'right' ? i * 2 : 0);
          const by = Math.round(ab[1] as number) + (p.view === 'right' ? 0 : i * 2);
          if (p.view === 'right') im.rect(bx, by - s(2), bx, by + s(2), 0);
          else im.rect(bx - s(2), by, bx + s(2), by, 0);
        }
        im.rect(Math.round(cx) - 1, cy + s(3), Math.round(cx) - 1, cy + s(4) + (p.open ? 1 : 0), 0);
      } else {
        // Tail feathers.
        if (p.view === 'right')
          im.rect(Math.round(cx) - s(5), cy + s(1), Math.round(cx) - s(3), cy + s(2), look.wing[1]);
        if (p.view === 'up')
          im.rect(Math.round(cx) - 1, cy + s(3), Math.round(cx), cy + s(5), look.wing[1]);
      }
      shadedEllipse(im, cx, cy, p.view === 'right' ? s(4) : s(3.4), s(3), look.body);
      // Head and beak.
      const hx = Math.round(cx + (p.view === 'right' ? s(3.5) : 0));
      const hy = cy - s(2) + (p.rear ? s(1) : 0);
      shadedEllipse(im, hx, hy, s(2.2), s(2.2), look.body);
      if (look.crest) im.rect(hx - 1, hy - s(4), hx, hy - s(3), look.body[3]);
      if (p.view === 'right') {
        im.rect(hx + s(2), hy, hx + s(3) + (p.open ? 1 : 0), hy + 1, look.beak);
        im.set(hx + 1, hy - 1, eye);
      } else if (p.view === 'down') {
        im.set(hx - 1, hy - 1, eye);
        im.set(hx + 1, hy - 1, eye);
        im.rect(hx, hy, hx, hy + 1 + (p.open ? 1 : 0), look.beak);
      }
      return im;
    },
  };
}

/** A moor wisp: a glowing orb with a wavering tail, bobbing. */
function wispMaker(id: string): Maker {
  return {
    id,
    size: 16,
    origin: [8, 13],
    walks: true,
    draw(p: Pose) {
      const im = new Img(16, 16);
      const cx = 8 + (p.view === 'right' ? Math.round(p.lunge / 2) : 0);
      const cy = 7 - p.bob - (p.rear ? 1 : 0);
      const wave = p.step < 0 ? p.stretch : p.step % 2;
      // The tail trails behind and below.
      for (let i = 0; i < 5; i++) {
        const tx = Math.round(
          cx + (p.view === 'right' ? -i : (i % 2 === wave ? 1 : -1) * (i > 2 ? 1 : 0)),
        );
        im.set(tx, Math.round(cy + 3 + i), i < 2 ? WATER[2] : i < 4 ? WATER[1] : WATER[0]);
      }
      shadedEllipse(im, cx, cy, 4, 4, [13, 14, 15, 15]);
      shadedEllipse(im, cx, cy, 2.4, 2.4, [15, 15, 15, 15]);
      im.set(Math.round(cx) - 1, Math.round(cy) - 1, 3);
      if (p.view !== 'up') {
        const e = p.hurt ? 0 : 12;
        im.set(Math.round(cx) - 1 + (p.view === 'right' ? 1 : 0), Math.round(cy), e);
        if (p.view === 'down') im.set(Math.round(cx) + 1, Math.round(cy), e);
        if (p.open) im.set(Math.round(cx), Math.round(cy) + 1, e);
      }
      return im;
    },
  };
}

interface CrabLook {
  body: Tones4;
  claw: Tones4;
}

/** A reed crab: wide shell, two claws raised to the front, four legs. */
function crabMaker(id: string, look: CrabLook): Maker {
  return {
    id,
    size: 16,
    origin: [8, 14],
    walks: true,
    draw(p: Pose) {
      const im = new Img(16, 16);
      const cx = 8 + (p.view === 'right' ? Math.round(p.lunge / 2) : 0);
      const cy = 10 - p.bob;
      const lift = (i: number): number => (p.step < 0 ? 0 : (p.step + i) % 2 === 0 ? 1 : 0);
      for (const [dx, i] of [
        [-5, 0],
        [-3, 1],
        [3, 1],
        [5, 0],
      ] as const)
        im.rect(
          Math.round(cx) + dx,
          cy + 2 - lift(i),
          Math.round(cx) + dx,
          cy + 4 - lift(i),
          look.body[0],
        );
      shadedEllipse(im, cx, cy, p.view === 'right' ? 5 : 6, 3.6 + p.stretch * 0.4, look.body);
      if (p.view !== 'up') {
        // Claws, raised; open when the pinch comes.
        const up = p.rear ? 3 : 1;
        for (const sx of [-1, 1]) {
          const clawX = Math.round(cx) + sx * (p.view === 'right' ? 4 : 6);
          shadedEllipse(im, clawX, cy - up - 1, 2.2, 2, look.claw);
          if (p.open) im.set(clawX, cy - up - 3, 0);
        }
        const e = p.hurt ? 0 : 3;
        im.set(Math.round(cx) - 2, cy - 4, e);
        im.set(Math.round(cx) + 1, cy - 4, e);
        im.rect(Math.round(cx) - 2, cy - 6, Math.round(cx) - 2, cy - 5, look.body[0]);
        im.rect(Math.round(cx) + 1, cy - 6, Math.round(cx) + 1, cy - 5, look.body[0]);
      } else {
        im.rect(Math.round(cx) - 3, cy - 1, Math.round(cx) + 2, cy - 1, look.body[3]);
      }
      return im;
    },
  };
}

/** A leech: a long segmented slug that humps along. */
function leechMaker(id: string): Maker {
  return {
    id,
    size: 16,
    origin: [8, 13],
    walks: true,
    draw(p: Pose) {
      const im = new Img(16, 16);
      const hump = p.step < 0 ? 0 : p.step % 2 === 0 ? 1 : 0;
      const len = p.view === 'right' ? 11 : 7;
      const x0 = 8 - Math.floor(len / 2) + (p.view === 'right' ? Math.round(p.lunge / 2) : 0);
      const tall = p.view === 'right' ? 1 : 2;
      for (let i = 0; i < len; i++) {
        const t = i / (len - 1);
        const rise = Math.round(Math.sin(t * Math.PI) * (3 + hump));
        const y = 12 - rise - (p.rear && i > len / 2 ? 2 : 0);
        const tone = i % 3 === 0 ? ROSE[1] : i % 3 === 1 ? FUR_RUST[1] : FUR_RUST[2];
        im.rect(x0 + i, y - tall, x0 + i, 12, tone);
        im.set(x0 + i, y - tall, FUR_RUST[3]);
      }
      if (p.view !== 'up') {
        const hx = p.view === 'right' ? x0 + len - 1 : 8;
        im.set(hx - (p.view === 'right' ? 1 : 2), 9, p.hurt ? 0 : 3);
        if (p.view === 'down') im.set(hx + 1, 9, p.hurt ? 0 : 3);
        if (p.open) im.rect(hx - 1, 11, hx, 12, 20);
      }
      return im;
    },
  };
}

type Figure = 'strawman' | 'bones' | 'rubblet';

interface FigureLook {
  figure: Figure;
  body: Tones4;
  accent: Tones4;
  size?: number;
}

/** A standing figure: a head, a trunk, two arms and two legs. The head and the build make the kind. */
function figureMaker(id: string, look: FigureLook): Maker {
  const size = look.size ?? 16;
  return {
    id,
    size,
    origin: [size / 2, size - 2],
    walks: true,
    draw(p: Pose) {
      const im = new Img(size, size);
      const cx = size / 2 + (p.view === 'right' ? Math.round(p.lunge / 2) : 0);
      const lift = (i: number): number => (p.step < 0 ? 0 : (p.step + i) % 2 === 0 ? 1 : 0);
      const stocky = look.figure === 'rubblet';
      const top = 2 + (p.rear ? 1 : 0) - p.bob;
      const hw = stocky ? 3 : 2;
      const bw = stocky ? 4.2 : look.figure === 'strawman' ? 3.4 : 2.6;
      // Legs.
      const legTone = look.figure === 'bones' ? look.body[2] : look.accent[1];
      im.rect(
        Math.round(cx) - 3,
        size - 5 - lift(0),
        Math.round(cx) - 2,
        size - 2 - lift(0),
        legTone,
      );
      im.rect(
        Math.round(cx) + 1,
        size - 5 - lift(1),
        Math.round(cx) + 2,
        size - 2 - lift(1),
        legTone,
      );
      // Trunk.
      shadedEllipse(im, cx, size - 8, bw, 3.6 + p.stretch * 0.4, look.body);
      if (look.figure === 'bones') {
        for (const y of [size - 10, size - 8, size - 6])
          im.rect(Math.round(cx) - 2, y, Math.round(cx) + 1, y, 0);
      }
      if (look.figure === 'strawman') {
        im.rect(Math.round(cx) - 2, size - 9, Math.round(cx) + 1, size - 9, look.accent[1]);
        im.rect(Math.round(cx) - 1, size - 6, Math.round(cx), size - 5, look.accent[2]);
      }
      // Arms, out while striking (the strawman holds them wide on its post).
      const reach = p.open || p.lunge > 1 ? 2 : 0;
      for (const sx of [-1, 1]) {
        const ax = Math.round(cx) + sx * Math.round(bw + 1);
        const ay = size - 10 + (look.figure === 'strawman' ? -1 : 0);
        im.rect(
          ax,
          ay - reach,
          ax,
          ay + 3 - reach,
          look.figure === 'bones' ? look.body[2] : look.accent[2],
        );
        if (look.figure === 'strawman')
          im.rect(ax + sx, ay - reach, ax + sx * 2, ay - reach, look.body[3]);
        if (look.figure === 'rubblet')
          im.rect(ax, ay + 2 - reach, ax + sx, ay + 3 - reach, look.body[1]);
      }
      // Head.
      const hy = top + 3;
      shadedEllipse(im, cx, hy, hw + 0.6, hw, look.figure === 'strawman' ? STRAW : look.body);
      if (look.figure === 'strawman') {
        // A hat with a brim, tied with a cloth.
        im.rect(Math.round(cx) - 4, top, Math.round(cx) + 3, top, WOOD[1]);
        im.rect(Math.round(cx) - 2, top - 2, Math.round(cx) + 1, top - 1, WOOD[2]);
      }
      if (look.figure === 'rubblet') {
        im.rect(Math.round(cx) - 3, top - 1, Math.round(cx) - 2, top, look.accent[3]);
        im.rect(Math.round(cx) + 1, top - 1, Math.round(cx) + 2, top, look.accent[2]);
      }
      if (p.view === 'down') {
        const e = p.hurt ? 0 : look.figure === 'bones' ? 22 : 3;
        im.set(Math.round(cx) - 2, hy, e);
        im.set(Math.round(cx) + 1, hy, e);
        im.rect(Math.round(cx) - 1, hy + 1, Math.round(cx), hy + 1 + (p.open ? 1 : 0), 0);
      } else if (p.view === 'right') {
        im.set(Math.round(cx) + 1, hy, p.hurt ? 0 : look.figure === 'bones' ? 22 : 3);
      }
      return im;
    },
  };
}

/** Every Dawnmeadow creature sprite. */
export function dawnmeadowCreatureSprites(): SpriteDef[] {
  return [
    quadMaker('creature.meadow_hare', {
      size: 16,
      body: [36, 37, 38, 39],
      snout: 40,
      eye: 3,
      ears: 'long',
      horns: 'none',
      tail: 'short',
      pale: 3,
      lean: true,
    }),
    birdMaker('creature.hedge_sparrow', { size: 16, body: [36, 37, 38, 39], wing: WOOD, beak: 46 }),
    wispMaker('creature.moor_wisp'),
    quadMaker('creature.downs_ram', {
      size: 20,
      body: [1, 2, 3, 3],
      snout: 41,
      eye: 0,
      ears: 'round',
      horns: 'ram',
      tail: 'short',
      pale: 3,
    }),
    quadMaker('creature.grain_rat', {
      size: 16,
      body: [17, 18, 19, 19],
      snout: 41,
      eye: 0,
      ears: 'round',
      horns: 'none',
      tail: 'long',
    }),
    quadMaker('creature.fox', {
      size: 16,
      body: FIRE,
      snout: 3,
      eye: 0,
      ears: 'point',
      horns: 'none',
      tail: 'bush',
      pale: 3,
      lean: true,
    }),
    figureMaker('creature.strawman', { figure: 'strawman', body: STRAW, accent: WOOD }),
    quadMaker('creature.burrow_mole', {
      size: 16,
      body: [17, 17, 18, 18],
      snout: 42,
      eye: 0,
      ears: 'none',
      horns: 'none',
      tail: 'short',
    }),
    birdMaker('creature.thistle_wasp', { size: 16, body: STRAW, wing: WATER, beak: 0, wasp: true }),
    figureMaker('creature.barrow_bones', { figure: 'bones', body: BONE, accent: STONE }),
    crabMaker('creature.reed_crab', { body: FIRE, claw: [21, 22, 23, 23] }),
    leechMaker('creature.marsh_leech'),
    leechMaker('creature.root_grub'),
    figureMaker('creature.rubblet', { figure: 'rubblet', body: STONE, accent: STONE }),
    birdMaker('creature.crag_hawk', {
      size: 20,
      body: WOOD,
      wing: [4, 5, 5, 6],
      beak: 46,
      crest: true,
    }),
    quadMaker('creature.moorhound', {
      size: 20,
      body: METAL,
      snout: 1,
      eye: 22,
      ears: 'point',
      horns: 'none',
      tail: 'long',
      lean: true,
    }),
    quadMaker('creature.hollowhorn', {
      size: 40,
      body: [32, 33, 34, 35],
      snout: 36,
      eye: 22,
      ears: 'point',
      horns: 'antler',
      tail: 'short',
      pale: 39,
    }),
  ].map(sprite);
}
