import type { AnimDef, SpriteDef } from '../types';
import { Img, outlined, shadedEllipse, toSprite, type Tones4 } from './img';

/**
 * Creature generators. Each draws three views (down, up, right; left is the right view mirrored)
 * with the same pose set as the paper dolls where it applies: idle 2, walk 4, attack 3, hurt 1.
 * Shapes are built from shaded ellipses and a few hand-placed details, then outlined once, so the
 * silhouette and light rules hold for every frame. Output is baked and reviewed on the contact sheet.
 */

type View = 'down' | 'up' | 'right';
const VIEWS: readonly View[] = ['down', 'up', 'right'];

/** What the body is doing this frame. */
interface Pose {
  view: View;
  /** Body lifted by this many px (bob). Negative is down. */
  bob: number;
  /** Alternating foot step 0 to 3, or -1 for standing. */
  step: number;
  /** Stretch (+) or squash (-) of the body in px. */
  stretch: number;
  /** Forward lunge in px along the facing. */
  lunge: number;
  /** Mouth or maw open. */
  open: boolean;
  /** Eyes shut (hurt). */
  hurt: boolean;
  /** Rearing: the front of the body is raised (wind-up). */
  rear: boolean;
}

const idle = (view: View, n: number): Pose => ({
  view,
  bob: n === 1 ? 1 : 0,
  step: -1,
  stretch: n,
  lunge: 0,
  open: false,
  hurt: false,
  rear: false,
});
const walk = (view: View, n: number): Pose => ({
  view,
  bob: n % 2 === 1 ? 1 : 0,
  step: n,
  stretch: 0,
  lunge: 0,
  open: false,
  hurt: false,
  rear: false,
});
const attack = (view: View, n: number): Pose => ({
  view,
  bob: n === 0 ? 0 : 0,
  step: -1,
  stretch: n === 0 ? 1 : n === 1 ? -1 : 0,
  lunge: n === 0 ? -1 : n === 1 ? 3 : 1,
  open: n === 1,
  hurt: false,
  rear: n === 0,
});
const hurt = (view: View): Pose => ({
  view,
  bob: 0,
  step: -1,
  stretch: -1,
  lunge: -1,
  open: true,
  hurt: true,
  rear: false,
});

interface Maker {
  id: string;
  size: number;
  /** Feet anchor. */
  origin: [number, number];
  walks: boolean;
  draw: (p: Pose) => Img;
}

function frames(m: Maker): Record<string, Img> {
  const out: Record<string, Img> = {};
  for (const v of VIEWS) {
    out[`idle_${v}_0`] = outlined(m.draw(idle(v, 0)));
    out[`idle_${v}_1`] = outlined(m.draw(idle(v, 1)));
    if (m.walks) for (let n = 0; n < 4; n++) out[`walk_${v}_${n}`] = outlined(m.draw(walk(v, n)));
    for (let n = 0; n < 3; n++) out[`attack_${v}_${n}`] = outlined(m.draw(attack(v, n)));
    out[`hurt_${v}`] = outlined(m.draw(hurt(v)));
  }
  return out;
}

function anims(walks: boolean): Record<string, AnimDef> {
  const out: Record<string, AnimDef> = {};
  for (const f of ['down', 'up', 'right', 'left'] as const) {
    const v = f === 'left' ? 'right' : f;
    const flip = f === 'left' ? { flipX: true } : {};
    const seq = (name: string, n: number): string[] =>
      Array.from({ length: n }, (_, i) => `${name}_${v}_${i}`);
    out[`idle_${f}`] = { fps: 2, frames: seq('idle', 2), ...flip };
    if (walks) out[`walk_${f}`] = { fps: 8, frames: seq('walk', 4), ...flip };
    out[`attack_${f}`] = { fps: 12, frames: seq('attack', 3), ...flip };
    out[`hurt_${f}`] = { fps: 4, frames: [`hurt_${v}`], ...flip };
  }
  return out;
}

function sprite(m: Maker): SpriteDef {
  return toSprite(m.id, 'core', m.origin, frames(m), anims(m.walks));
}

const FOLIAGE: Tones4 = [8, 9, 10, 11];
const WOOD: Tones4 = [4, 5, 6, 7];
const ROSE: Tones4 = [40, 41, 42, 43];
const STONE: Tones4 = [16, 17, 18, 19];

// ---- Mossling: a round mossy creature on stubby feet. 16 x 16, feet at (8, 14).
interface MosslingLook {
  body: Tones4;
  feet: Tones4;
}

function mosslingMaker(id: string, look: MosslingLook): Maker {
  return {
    id,
    size: 16,
    origin: [8, 14],
    walks: true,
    draw(p) {
      const im = new Img(16, 16);
      const x = 8 + (p.view === 'right' ? p.lunge : 0);
      const y = 9 - p.bob + (p.view === 'down' ? Math.max(0, p.lunge) : 0) - (p.rear ? 1 : 0);
      const ry = 4.5 + p.stretch * 0.5;
      // Feet first, so the body overlaps them.
      const lift = (i: number): number => (p.step < 0 ? 0 : (p.step + i) % 2 === 0 ? 1 : 0);
      if (p.view === 'right') {
        im.rect(5, 12 - lift(0), 7, 13 - lift(0), look.feet[0]);
        im.rect(9, 12 - lift(1), 11, 13 - lift(1), look.feet[1]);
      } else {
        im.rect(4, 12 - lift(0), 6, 13 - lift(0), look.feet[0]);
        im.rect(9, 12 - lift(1), 11, 13 - lift(1), look.feet[1]);
      }
      shadedEllipse(im, x, y, p.view === 'right' ? 5.2 : 5.5, ry, look.body);
      // Moss tufts on top, light.
      for (const [dx, dy] of [
        [-2, -5],
        [1, -5],
        [3, -4],
        [-4, -3],
      ] as const)
        im.set(
          Math.round(x + dx),
          Math.round(y + dy),
          p.view === 'up' ? look.body[3] : look.body[2],
        );
      im.set(Math.round(x - 1), Math.round(y - 6), look.body[3]);
      if (p.view === 'down') {
        const e = p.hurt ? 0 : 3;
        im.rect(x - 3, y - 1, x - 2, y, e);
        im.rect(x + 1, y - 1, x + 2, y, e);
        if (!p.hurt) {
          im.set(x - 2, y, 0);
          im.set(x + 2, y, 0);
        }
        if (p.open) im.rect(x - 1, y + 2, x, y + 3, 20);
      } else if (p.view === 'right') {
        im.rect(x + 1, y - 1, x + 2, y, p.hurt ? 0 : 3);
        if (!p.hurt) im.set(x + 2, y, 0);
        if (p.open) im.rect(x + 3, y + 2, x + 4, y + 3, 20);
      }
      return im;
    },
  };
}

const mossling = mosslingMaker('creature.mossling', { body: FOLIAGE, feet: WOOD });

// ---- Spitbloom: a rooted flower that spits seeds. 16 x 16, base at (8, 14).
interface BloomLook {
  stem: Tones4;
  head: Tones4;
  inner: Tones4;
}

function bloomMaker(id: string, look: BloomLook): Maker {
  return {
    id,
    size: 16,
    origin: [8, 14],
    walks: false,
    draw(p) {
      const im = new Img(16, 16);
      const sway = p.view === 'right' ? p.lunge : 0;
      // Stem and two leaves.
      im.rect(7, 9 - p.bob, 8, 13, look.stem[1]);
      im.rect(8, 9 - p.bob, 8, 13, look.stem[0]);
      im.rect(3, 11, 6, 12, look.stem[2]);
      im.rect(4, 10, 5, 10, look.stem[3]);
      im.rect(9, 12, 12, 13, look.stem[1]);
      im.rect(10, 11, 11, 11, look.stem[2]);
      // The head: bigger when winding up, petals all around.
      const r = p.rear ? 4.6 : p.open ? 3.6 : 4;
      const cx = 8 + sway;
      const cy = 6 - p.bob - (p.rear ? 1 : 0) + (p.open ? 1 : 0);
      shadedEllipse(im, cx, cy, r + 1.5, r + 0.5, look.head);
      shadedEllipse(im, cx, cy, r - 1, r - 1.5, look.inner);
      if (p.view === 'down') {
        const w = p.open ? 3 : 2;
        im.rect(cx - w + 1, cy - 1, cx + w - 2, cy + (p.open ? 2 : 1), p.hurt ? 20 : 0);
        if (p.open && !p.hurt) im.set(cx, cy, 20);
        im.set(cx - 3, cy - 2, p.hurt ? 0 : 46);
        im.set(cx + 2, cy - 2, p.hurt ? 0 : 46);
      } else if (p.view === 'right') {
        im.rect(cx + 2, cy - 1, cx + (p.open ? 5 : 3), cy + (p.open ? 2 : 1), p.hurt ? 20 : 0);
        im.set(cx, cy - 2, p.hurt ? 0 : 46);
      } else {
        im.rect(cx - 1, cy - 2, cx, cy - 1, look.head[3]);
      }
      return im;
    },
  };
}

const spitbloom = bloomMaker('creature.spitbloom', {
  stem: FOLIAGE,
  head: ROSE,
  inner: [41, 42, 43, 43],
});

// ---- Boars: side view is the main drawing; front and back are narrower.
interface BoarLook {
  body: Tones4;
  bristle: Tones4;
  snout: Tones4;
  eye: number;
  berry: number;
  tusk: number;
}

function boarMaker(id: string, size: number, scale: number, look: BoarLook): Maker {
  const s = (n: number): number => Math.round(n * scale);
  return {
    id,
    size,
    origin: [size / 2, Math.round(size - 2 * scale - 2)],
    walks: true,
    draw(p) {
      const im = new Img(size, size);
      const cy = size - s(8) - p.bob - (p.rear ? 1 : 0);
      const cx = size / 2 + (p.view === 'right' ? p.lunge * scale - s(1) : 0);
      const lift = (i: number): number =>
        p.step < 0 ? 0 : (p.step + i) % 2 === 0 ? Math.round(scale) : 0;
      if (p.view === 'right') {
        // Legs: four, front pair and back pair.
        for (const [dx, i] of [
          [-6, 0],
          [-3, 1],
          [3, 1],
          [6, 0],
        ] as const)
          im.rect(
            Math.round(cx + s(dx)) - 1,
            cy + s(3) - lift(i),
            Math.round(cx + s(dx)),
            cy + s(6) - lift(i),
            look.body[0],
          );
        shadedEllipse(im, cx, cy, s(8.5), s(5.5) + p.stretch * 0.5, look.body);
        // Bristles along the back, with the odd berry.
        for (let i = -6; i <= 4; i += 2) {
          const bx = Math.round(cx + s(i));
          const by = cy - s(5.5) - (i % 4 === 0 ? 1 : 0);
          im.rect(
            bx,
            by - Math.round(scale),
            bx + 1,
            by + 1,
            look.bristle[(i + 8) % 3 === 0 ? 3 : 2],
          );
          if (i === -2) im.set(bx, by - Math.round(scale) - 1, look.berry);
        }
        // Head to the right: snout, tusk, eye. It drops when winding up for a charge.
        const hx = Math.round(cx + s(7.5));
        const hy = cy - s(1) + (p.rear ? s(2) : 0);
        shadedEllipse(im, hx, hy, s(3.5), s(3.2), look.body);
        shadedEllipse(im, hx + s(3), hy + s(1), s(2.2), s(1.8), look.snout);
        im.set(hx + s(3), hy + s(1), 0);
        im.rect(hx + s(2), hy + s(2.5), hx + s(3), hy + s(3.5) + (p.open ? 1 : 0), look.tusk);
        im.set(hx + s(0.5), hy - s(1), p.hurt ? 0 : look.eye);
        im.set(hx - s(1.5), hy - s(3.5), look.body[0]);
        im.set(hx - s(1), hy - s(3.5), look.body[1]);
      } else {
        const w = s(5.5);
        const lunge = p.view === 'down' ? Math.max(0, p.lunge) : 0;
        im.rect(
          Math.round(cx) - s(3.5),
          cy + s(3) - lift(0),
          Math.round(cx) - s(2.5),
          cy + s(6) - lift(0),
          look.body[0],
        );
        im.rect(
          Math.round(cx) + s(2.5),
          cy + s(3) - lift(1),
          Math.round(cx) + s(3.5),
          cy + s(6) - lift(1),
          look.body[0],
        );
        shadedEllipse(im, cx, cy + lunge, w, s(5.3) + p.stretch * 0.5, look.body);
        if (p.view === 'down') {
          shadedEllipse(im, cx, cy + s(2) + lunge, s(3), s(2.2), look.snout);
          im.set(Math.round(cx) - 1, cy + s(2) + lunge, 0);
          im.set(Math.round(cx) + 1, cy + s(2) + lunge, 0);
          im.set(Math.round(cx) - s(3), cy + s(3) + lunge, look.tusk);
          im.set(Math.round(cx) + s(3) - 1, cy + s(3) + lunge, look.tusk);
          const e = p.hurt ? 0 : look.eye;
          im.set(Math.round(cx) - s(3), cy - s(1) + lunge, e);
          im.set(Math.round(cx) + s(3) - 1, cy - s(1) + lunge, e);
          // Brow bristles.
          im.rect(
            Math.round(cx) - s(2),
            cy - s(5),
            Math.round(cx) + s(2),
            cy - s(4),
            look.bristle[2],
          );
        } else {
          for (let i = -4; i <= 4; i += 2)
            im.rect(
              Math.round(cx) + s(i) - 1,
              cy - s(5) - 1,
              Math.round(cx) + s(i),
              cy - s(2),
              look.bristle[i % 4 === 0 ? 3 : 2],
            );
          im.set(Math.round(cx), cy - s(5) - 2, look.berry);
        }
      }
      return im;
    },
  };
}

const boar = boarMaker('creature.bramble_boar', 32, 1.4, {
  body: WOOD,
  bristle: FOLIAGE,
  snout: ROSE,
  eye: 22,
  berry: 21,
  tusk: 3,
});
const bramblehide = boarMaker('creature.old_bramblehide', 48, 2.1, {
  body: STONE,
  bristle: [8, 9, 10, 11],
  snout: [16, 17, 18, 19],
  eye: 23,
  berry: 20,
  tusk: 3,
});

// ---- Whisperwood creatures (M3-12): tier 2, the same bodies in the colors of the old forest.
const WATER: Tones4 = [12, 13, 14, 15];
const FIRE: Tones4 = [20, 21, 22, 23];
const thornling = mosslingMaker('creature.thornling', { body: WOOD, feet: STONE });
const fogcap = bloomMaker('creature.fogcap', {
  stem: STONE,
  head: WATER,
  inner: [13, 14, 15, 15],
});
const cinderback = boarMaker('creature.cinderback_boar', 32, 1.5, {
  body: STONE,
  bristle: FIRE,
  snout: STONE,
  eye: 23,
  berry: 21,
  tusk: 3,
});

// ---- Training dummy: a post with a crossbar and a straw head. 16 x 24, feet at (8, 22).
const dummy: Maker = {
  id: 'creature.training_dummy',
  size: 24,
  origin: [8, 22],
  walks: false,
  draw(p) {
    const im = new Img(16, 24);
    const sway = p.hurt ? 1 : p.step === -1 && p.stretch === 1 ? 0 : 0;
    const x = 8 + (p.hurt ? (p.view === 'up' ? -1 : 1) : 0) + sway;
    // Post and foot.
    im.rect(x - 1, 8, x, 21, WOOD[1]);
    im.rect(x - 1, 8, x - 1, 21, WOOD[2]);
    im.rect(x - 4, 20, x + 3, 21, WOOD[0]);
    if (p.view === 'right') {
      // Edge on: the crossbar is a thin plank.
      im.rect(x - 1, 11, x, 12, WOOD[2]);
    } else {
      im.rect(x - 6, 11, x + 5, 12, WOOD[2]);
      im.rect(x - 6, 11, x + 5, 11, WOOD[3]);
      im.rect(x - 7, 12, x - 6, 15, WOOD[1]);
      im.rect(x + 5, 12, x + 6, 15, WOOD[1]);
    }
    // Sack body tied to the post.
    shadedEllipse(im, x - 0.5, 15.5, 3.4, 4, [44, 45, 46, 47]);
    im.rect(x - 3, 14, x + 2, 14, WOOD[1]);
    // Head.
    shadedEllipse(im, x - 0.5, 6, 3, 3, [44, 45, 46, 47]);
    if (p.view === 'down') {
      im.set(x - 2, 6, 0);
      im.set(x + 1, 6, 0);
    }
    return im;
  },
};

/** Every creature sprite. */
export function creatureSprites(): SpriteDef[] {
  return [mossling, spitbloom, boar, bramblehide, thornling, fogcap, cinderback, dummy].map(sprite);
}
