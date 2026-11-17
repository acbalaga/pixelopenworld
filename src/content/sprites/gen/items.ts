import type { SpriteDef } from '../types';
import { Img, toSprite } from './img';

/**
 * Item icons, 12 x 12, from shape templates and ramps (art bible: generators multiply bases).
 * Light from the top left. A 1 px outline in the darkest neutral keeps them readable on any
 * slot color. Each icon is one frame, `base`.
 */
const SIZE = 12;
const OUT = 0;

type Ramp = readonly [number, number, number, number];

const METAL: Ramp = [28, 29, 30, 31];
const RUST: Ramp = [20, 4, 5, 6];
const WOOD: Ramp = [4, 5, 6, 7];
const LEAF: Ramp = [8, 9, 10, 11];
const FIRE: Ramp = [20, 21, 22, 23];
const WATER: Ramp = [12, 13, 14, 15];
const VIOLET: Ramp = [24, 25, 26, 27];
const STONE: Ramp = [16, 17, 18, 19];
const GOLD: Ramp = [44, 45, 46, 47];
const ROSE: Ramp = [40, 41, 42, 43];
const CREAM: Ramp = [4, 44, 45, 46];
const COPPER: Ramp = [4, 21, 22, 23];
const STEEL: Ramp = [28, 30, 31, 3];
const BRONZE: Ramp = [44, 5, 45, 46];
const LEATHER: Ramp = [4, 5, 6, 7];
const SILK: Ramp = [40, 41, 42, 43];

function line(im: Img, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    im.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c);
  }
}

/** A shaded disc: shadow bottom right, highlight top left. */
function disc(im: Img, cx: number, cy: number, r: number, ramp: Ramp): void {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r + r * 0.6) continue;
      const lit = dx + dy;
      im.set(x, y, lit < -r * 0.6 ? ramp[3] : lit > r * 0.5 ? ramp[1] : ramp[2]);
    }
}

/** 1 px outline around everything drawn, painted only on empty pixels. */
function outline(im: Img): Img {
  const out = new Img(im.w, im.h);
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++) {
      const c = im.get(x, y);
      if (c !== null) {
        out.set(x, y, c);
        continue;
      }
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => im.get(x + (dx as number), y + (dy as number)) !== null);
      if (near) out.set(x, y, OUT);
    }
  return out;
}

function icon(name: string, draw: (im: Img) => void): SpriteDef {
  const im = new Img(SIZE, SIZE);
  draw(im);
  return toSprite(`icon.${name}`, 'ui', [0, 0], { base: outline(im) });
}

function sword(name: string, blade: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 9, 2, 4, 7, blade[2]);
    line(im, 10, 3, 5, 8, blade[1]);
    line(im, 8, 2, 4, 6, blade[3]);
    line(im, 3, 6, 6, 9, WOOD[2]);
    line(im, 4, 8, 2, 10, WOOD[1]);
  });
}

function tunic(name: string, c: Ramp, sleeves = true): SpriteDef {
  return icon(name, (im) => {
    im.rect(3, 2, 8, 9, c[2]);
    im.rect(3, 2, 4, 9, c[3]);
    im.rect(7, 4, 8, 9, c[1]);
    if (sleeves) {
      im.rect(1, 2, 2, 5, c[2]);
      im.rect(9, 2, 10, 5, c[1]);
    }
    im.rect(5, 2, 6, 3, c[0]);
  });
}

function dish(name: string, food: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 7, 9, 8, STONE[3]);
    im.rect(3, 9, 8, 9, STONE[2]);
    im.rect(3, 5, 8, 6, food[2]);
    im.rect(3, 5, 5, 5, food[3]);
    im.set(6, 3, STONE[3]);
    im.set(7, 2, STONE[3]);
  });
}

function berries(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 6, 1, 6, 4, LEAF[2]);
    im.set(7, 2, LEAF[3]);
    disc(im, 4, 7, 2, c);
    disc(im, 8, 7, 2, c);
    disc(im, 6, 8, 2, c);
  });
}

function herb(name: string, leaf: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 6, 10, 6, 4, LEAF[1]);
    im.rect(3, 4, 5, 5, leaf[2]);
    im.rect(7, 3, 9, 4, leaf[3]);
    im.rect(4, 7, 5, 8, leaf[3]);
    im.rect(7, 6, 8, 7, leaf[2]);
    im.set(6, 2, leaf[3]);
  });
}

// ---- Builders for the tier 1 to 2 set (M3-05). Each is a small template tinted by a ramp. ----

function spear(name: string, shaft: Ramp, head: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 2, 10, 8, 4, shaft[2]);
    line(im, 3, 10, 9, 4, shaft[1]);
    im.rect(8, 1, 10, 3, head[3]);
    im.set(10, 1, head[2]);
    im.set(8, 3, head[1]);
  });
}

function shield(name: string, face: Ramp, rim: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 2, 9, 8, face[2]);
    im.rect(3, 9, 8, 9, face[1]);
    im.rect(4, 10, 7, 10, face[1]);
    im.rect(2, 2, 9, 2, rim[2]);
    im.rect(5, 3, 6, 9, rim[1]);
    im.rect(2, 2, 3, 6, face[3]);
  });
}

function buckler(name: string, face: Ramp): SpriteDef {
  return icon(name, (im) => {
    disc(im, 6, 6, 4, face);
    disc(im, 6, 6, 1, METAL);
  });
}

function helm(name: string, c: Ramp, crest = false): SpriteDef {
  return icon(name, (im) => {
    disc(im, 6, 5, 4, c);
    im.rect(2, 6, 9, 9, c[2]);
    im.rect(2, 6, 3, 8, c[3]);
    im.rect(8, 7, 9, 9, c[1]);
    im.rect(5, 7, 6, 9, c[0]);
    if (crest) im.rect(5, 0, 6, 1, FIRE[2]);
  });
}

function hood(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    disc(im, 6, 5, 4, c);
    im.rect(2, 6, 9, 10, c[2]);
    im.rect(2, 6, 3, 9, c[3]);
    im.rect(8, 7, 9, 10, c[1]);
    im.rect(4, 6, 7, 8, c[0]);
  });
}

function trousers(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 1, 9, 4, c[2]);
    im.rect(2, 5, 5, 10, c[2]);
    im.rect(6, 5, 9, 10, c[1]);
    im.rect(2, 1, 4, 3, c[3]);
    im.rect(5, 5, 6, 10, null);
    im.rect(2, 1, 9, 1, c[0]);
  });
}

function skirt(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(3, 1, 8, 2, c[0]);
    im.rect(3, 3, 8, 6, c[2]);
    im.rect(2, 7, 9, 10, c[2]);
    im.rect(2, 3, 4, 10, c[3]);
    im.rect(7, 5, 9, 10, c[1]);
  });
}

function mail(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(3, 2, 8, 9, c[2]);
    im.rect(1, 2, 2, 5, c[2]);
    im.rect(9, 2, 10, 5, c[1]);
    for (let y = 3; y <= 9; y += 2)
      for (let x = 3 + (y % 4 === 3 ? 1 : 0); x <= 8; x += 2) im.set(x, y, c[3]);
    im.rect(5, 2, 6, 2, c[0]);
  });
}

function ring(name: string, band: Ramp, gem: Ramp): SpriteDef {
  return icon(name, (im) => {
    disc(im, 6, 7, 3, band);
    im.rect(5, 6, 7, 8, null);
    disc(im, 6, 3, 1, gem);
  });
}

function amulet(name: string, chain: Ramp, stone: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 3, 1, 5, 5, chain[2]);
    line(im, 9, 1, 7, 5, chain[2]);
    disc(im, 6, 7, 2, stone);
    im.set(6, 6, stone[3]);
  });
}

function charm(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 6, 0, 6, 2, c[1]);
    disc(im, 6, 6, 3, c);
    im.rect(5, 5, 7, 7, c[3]);
  });
}

function belt(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(1, 4, 10, 7, c[2]);
    im.rect(1, 4, 10, 4, c[3]);
    im.rect(1, 7, 10, 7, c[1]);
    im.rect(5, 4, 7, 7, GOLD[2]);
    im.rect(6, 5, 6, 6, null);
  });
}

function pick(name: string, head: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 3, 10, 8, 3, WOOD[2]);
    line(im, 4, 10, 9, 3, WOOD[1]);
    line(im, 2, 3, 6, 1, head[2]);
    line(im, 6, 1, 10, 4, head[2]);
    line(im, 2, 4, 6, 2, head[3]);
    im.set(2, 4, head[1]);
    im.set(10, 5, head[1]);
  });
}

function axe(name: string, head: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 2, 10, 8, 2, WOOD[2]);
    line(im, 3, 10, 9, 2, WOOD[1]);
    im.rect(5, 1, 9, 4, head[2]);
    im.rect(4, 2, 4, 5, head[3]);
    im.rect(8, 4, 10, 5, head[1]);
    im.rect(5, 1, 7, 2, head[3]);
  });
}

function sickle(name: string, blade: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 2, 10, 5, 6, WOOD[2]);
    line(im, 3, 10, 6, 6, WOOD[1]);
    line(im, 5, 5, 6, 2, blade[2]);
    line(im, 6, 2, 9, 1, blade[3]);
    line(im, 9, 1, 10, 4, blade[2]);
    line(im, 9, 2, 8, 4, blade[1]);
  });
}

function rod(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 1, 10, 9, 1, c[2]);
    line(im, 2, 10, 10, 1, c[1]);
    line(im, 10, 1, 10, 7, STONE[3]);
    disc(im, 10, 8, 1, FIRE);
    im.rect(2, 8, 3, 9, c[3]);
  });
}

function hammer(name: string, head: Ramp): SpriteDef {
  return icon(name, (im) => {
    line(im, 3, 10, 8, 4, WOOD[2]);
    line(im, 4, 10, 9, 4, WOOD[1]);
    im.rect(5, 1, 10, 4, head[2]);
    im.rect(5, 1, 10, 1, head[3]);
    im.rect(9, 3, 10, 4, head[1]);
  });
}

function ore(name: string, vein: Ramp): SpriteDef {
  return icon(name, (im) => {
    disc(im, 6, 6, 4, STONE);
    im.set(4, 5, vein[3]);
    im.set(5, 5, vein[2]);
    im.set(7, 7, vein[3]);
    im.set(8, 7, vein[2]);
    im.set(5, 8, vein[2]);
    im.set(8, 4, vein[3]);
  });
}

function ingot(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(1, 5, 10, 8, c[2]);
    im.rect(2, 4, 9, 4, c[3]);
    im.rect(1, 8, 10, 8, c[1]);
    im.rect(10, 5, 10, 7, c[1]);
    im.rect(3, 5, 5, 5, c[3]);
  });
}

function log(name: string, bark: Ramp, wood: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 4, 8, 9, bark[2]);
    im.rect(2, 4, 8, 4, bark[3]);
    im.rect(2, 9, 8, 9, bark[1]);
    disc(im, 9, 6, 2, wood);
    im.set(9, 6, wood[0]);
  });
}

function plank(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(1, 3, 10, 5, c[2]);
    im.rect(1, 6, 10, 8, c[1]);
    im.rect(1, 3, 10, 3, c[3]);
    im.set(3, 4, c[0]);
    im.set(7, 7, c[0]);
  });
}

function fiber(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    for (let i = 0; i < 4; i++) line(im, 2 + i * 2, 10, 3 + i * 2, 2, c[2 + (i % 2)] as number);
    line(im, 1, 6, 10, 6, c[1]);
  });
}

function cloth(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 2, 9, 9, c[2]);
    im.rect(2, 2, 9, 2, c[3]);
    im.rect(2, 9, 9, 9, c[1]);
    for (let x = 3; x <= 8; x += 2) im.rect(x, 3, x, 8, c[1]);
    im.rect(9, 2, 9, 4, c[3]);
  });
}

function bottle(name: string, liquid: Ramp, cork = true): SpriteDef {
  return icon(name, (im) => {
    if (cork) im.rect(5, 1, 6, 2, WOOD[2]);
    im.rect(5, 3, 6, 4, STONE[3]);
    im.rect(3, 5, 8, 10, liquid[2]);
    im.rect(3, 5, 4, 10, liquid[3]);
    im.rect(7, 6, 8, 10, liquid[1]);
    im.rect(3, 5, 8, 5, STONE[3]);
  });
}

function orb(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    disc(im, 6, 6, 4, c);
    im.set(4, 4, c[3]);
    im.set(5, 4, c[3]);
    im.set(4, 5, c[3]);
  });
}

function dust(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(3, 7, 8, 9, c[2]);
    im.rect(4, 5, 7, 6, c[2]);
    im.rect(5, 3, 6, 4, c[3]);
    im.rect(3, 9, 8, 9, c[1]);
    im.set(4, 7, c[3]);
  });
}

function gem(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(4, 3, 7, 3, c[3]);
    im.rect(2, 4, 9, 6, c[2]);
    im.rect(3, 7, 8, 7, c[2]);
    im.rect(4, 8, 7, 8, c[1]);
    im.rect(5, 9, 6, 9, c[1]);
    im.rect(3, 4, 4, 5, c[3]);
  });
}

function mushroom(name: string, cap: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(5, 6, 6, 10, CREAM[3]);
    disc(im, 6, 5, 4, cap);
    im.rect(2, 6, 9, 6, cap[1]);
    im.set(5, 3, CREAM[3]);
    im.set(8, 5, CREAM[3]);
  });
}

function flask(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(5, 1, 6, 3, STONE[3]);
    disc(im, 6, 7, 3, STONE);
    im.rect(4, 6, 8, 9, c[2]);
    im.rect(4, 6, 5, 8, c[3]);
  });
}

function bowl(name: string, food: Ramp, steam = true): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 6, 9, 8, WOOD[2]);
    im.rect(3, 9, 8, 9, WOOD[1]);
    im.rect(3, 5, 8, 5, food[2]);
    im.rect(3, 5, 5, 5, food[3]);
    if (steam) {
      im.set(5, 3, STONE[3]);
      im.set(7, 2, STONE[3]);
    }
  });
}

function pie(name: string, crust: Ramp, fill: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(1, 6, 10, 8, crust[2]);
    im.rect(2, 4, 9, 5, crust[3]);
    im.rect(3, 5, 8, 5, fill[2]);
    im.rect(1, 8, 10, 8, crust[1]);
    im.rect(4, 3, 7, 3, crust[2]);
  });
}

function fish(name: string, c: Ramp): SpriteDef {
  return icon(name, (im) => {
    im.rect(2, 5, 8, 7, c[2]);
    im.rect(3, 4, 7, 4, c[3]);
    im.rect(3, 8, 7, 8, c[1]);
    im.rect(9, 4, 10, 8, c[1]);
    im.set(3, 5, STONE[0]);
  });
}

export const ITEM_ICONS: readonly SpriteDef[] = [
  sword('sword_rusty', RUST),
  sword('sword_iron', METAL),
  icon('spear_ash', (im) => {
    line(im, 2, 10, 8, 4, WOOD[2]);
    line(im, 3, 10, 9, 4, WOOD[1]);
    im.rect(8, 1, 10, 3, METAL[3]);
    im.set(10, 1, METAL[2]);
    im.set(8, 3, METAL[1]);
  }),
  icon('shield_wood', (im) => {
    im.rect(2, 2, 9, 8, WOOD[2]);
    im.rect(3, 9, 8, 9, WOOD[1]);
    im.rect(4, 10, 7, 10, WOOD[1]);
    im.rect(2, 2, 9, 2, METAL[2]);
    im.rect(5, 3, 6, 9, METAL[1]);
    im.rect(2, 2, 3, 6, WOOD[3]);
  }),
  tunic('outfit_wayfarer', WATER),
  tunic('outfit_leather', WOOD),
  icon('outfit_scholar', (im) => {
    im.rect(3, 2, 8, 10, VIOLET[2]);
    im.rect(3, 2, 4, 10, VIOLET[3]);
    im.rect(7, 4, 8, 10, VIOLET[1]);
    im.rect(1, 3, 2, 7, VIOLET[2]);
    im.rect(9, 3, 10, 7, VIOLET[1]);
    im.rect(5, 2, 6, 5, VIOLET[0]);
    im.rect(5, 8, 6, 8, GOLD[2]);
  }),
  icon('cap_wool', (im) => {
    disc(im, 6, 6, 4, ROSE);
    im.rect(1, 7, 10, 9, ROSE[1]);
    im.rect(2, 7, 4, 8, ROSE[3]);
    disc(im, 6, 1, 1, ROSE);
  }),
  icon('ring_copper', (im) => {
    disc(im, 6, 7, 3, FIRE);
    im.rect(5, 6, 7, 8, null);
    disc(im, 6, 3, 1, GOLD);
  }),
  herb('sunwort', GOLD),
  herb('dewmint', LEAF),
  berries('berry_red', FIRE),
  berries('berry_blue', WATER),
  icon('raw_meat', (im) => {
    disc(im, 6, 6, 3, ROSE);
    im.rect(3, 5, 8, 6, ROSE[2]);
    im.rect(4, 5, 5, 5, CREAM[3]);
    line(im, 8, 8, 10, 10, CREAM[3]);
    im.set(10, 9, CREAM[3]);
    im.set(9, 10, CREAM[3]);
  }),
  icon('moss_tuft', (im) => {
    im.rect(2, 6, 9, 9, LEAF[2]);
    im.rect(3, 4, 5, 6, LEAF[3]);
    im.rect(6, 3, 8, 6, LEAF[2]);
    im.rect(2, 9, 9, 9, LEAF[1]);
    im.set(4, 7, LEAF[3]);
  }),
  icon('seed_pod', (im) => {
    disc(im, 6, 6, 3, WOOD);
    im.rect(5, 3, 6, 9, WOOD[1]);
    im.set(6, 1, LEAF[2]);
    line(im, 6, 1, 6, 3, LEAF[1]);
  }),
  icon('boar_hide', (im) => {
    im.rect(2, 3, 9, 8, WOOD[1]);
    im.rect(2, 3, 5, 5, WOOD[2]);
    im.rect(1, 5, 1, 6, WOOD[1]);
    im.rect(10, 6, 10, 7, WOOD[1]);
    im.rect(4, 9, 7, 9, WOOD[1]);
    im.set(7, 5, WOOD[3]);
  }),
  dish('herb_tea', LEAF),
  dish('berry_compote', VIOLET),
  icon('herbed_skewer', (im) => {
    line(im, 1, 10, 10, 1, WOOD[3]);
    disc(im, 4, 7, 1, ROSE);
    disc(im, 6, 5, 1, LEAF);
    disc(im, 8, 3, 1, ROSE);
    im.rect(3, 7, 5, 8, ROSE[2]);
  }),
  dish('hearty_stew', FIRE),
  icon('dish_bread', (im) => {
    im.rect(2, 4, 9, 8, GOLD[2]);
    im.rect(3, 3, 8, 3, GOLD[2]);
    im.rect(2, 4, 5, 5, GOLD[3]);
    im.rect(2, 8, 9, 8, GOLD[1]);
    line(im, 4, 4, 5, 6, GOLD[1]);
    line(im, 7, 4, 8, 6, GOLD[1]);
  }),
  icon('honey_cake', (im) => {
    im.rect(2, 6, 9, 9, GOLD[1]);
    im.rect(2, 4, 9, 6, GOLD[3]);
    im.rect(2, 4, 4, 5, CREAM[3]);
    im.rect(5, 3, 6, 4, FIRE[2]);
    im.set(5, 2, GOLD[3]);
  }),
  icon('coin', (im) => {
    disc(im, 6, 6, 4, GOLD);
    im.rect(5, 4, 6, 8, GOLD[1]);
  }),
  icon('burnt_mess', (im) => {
    disc(im, 6, 7, 3, STONE);
    im.rect(3, 6, 8, 8, STONE[0]);
    im.rect(3, 6, 4, 6, STONE[1]);
    im.set(5, 3, STONE[2]);
    im.set(6, 2, STONE[3]);
  }),
  icon('old_key', (im) => {
    disc(im, 4, 4, 2, GOLD);
    im.set(4, 4, null);
    line(im, 5, 5, 10, 10, GOLD[2]);
    im.rect(8, 9, 9, 9, GOLD[2]);
    im.rect(10, 8, 10, 8, GOLD[2]);
  }),
  icon('river_pebble', (im) => {
    disc(im, 6, 7, 3, STONE);
    im.rect(3, 6, 8, 8, STONE[2]);
    im.rect(3, 6, 4, 6, STONE[3]);
  }),
  icon('crow_feather', (im) => {
    line(im, 2, 10, 9, 2, [0, 1, 17, 17][2] as number);
    line(im, 3, 10, 9, 3, [0, 1, 17, 17][1] as number);
    line(im, 4, 9, 8, 4, WATER[1]);
    im.rect(8, 1, 10, 3, [0, 1, 17, 17][2] as number);
    im.set(9, 2, WATER[1]);
  }),
  icon('bone_shard', (im) => {
    line(im, 2, 9, 9, 2, CREAM[3]);
    line(im, 3, 9, 9, 3, CREAM[2]);
    im.rect(1, 9, 3, 10, CREAM[3]);
    im.rect(8, 1, 10, 2, CREAM[3]);
  }),
  icon('lantern_oil', (im) => {
    im.rect(4, 2, 7, 3, WOOD[2]);
    im.rect(3, 4, 8, 9, WATER[2]);
    im.rect(3, 4, 4, 9, WATER[3]);
    im.rect(7, 4, 8, 9, WATER[1]);
    im.rect(4, 7, 7, 9, GOLD[2]);
  }),
  icon('worn_map', (im) => {
    im.rect(2, 2, 9, 9, CREAM[2]);
    im.rect(2, 2, 9, 2, CREAM[3]);
    im.rect(2, 9, 9, 9, CREAM[1]);
    line(im, 3, 7, 5, 4, FIRE[2]);
    line(im, 5, 4, 8, 6, FIRE[2]);
    im.set(8, 6, FIRE[1]);
  }),
  // ---- Tier 1 to 2 set (M3-05) ----
  sword('sword_bronze', BRONZE),
  sword('sword_steel', STEEL),
  spear('spear_hunter', WOOD, STEEL),
  spear('spear_iron', WOOD, METAL),
  spear('spear_steel', ROSE, STEEL),
  buckler('shield_buckler', WOOD),
  shield('shield_iron', STONE, METAL),
  shield('shield_tower', METAL, STEEL),
  trousers('trousers_wool', WOOD),
  hood('hood_silk', SILK),
  tunic('robe_silk', SILK),
  skirt('skirt_silk', SILK),
  hood('cap_leather', LEATHER),
  tunic('jerkin_leather', GOLD, false),
  trousers('chaps_leather', GOLD),
  hood('hood_hide', WOOD),
  trousers('chaps_hide', WOOD),
  helm('coif_mail', COPPER),
  mail('hauberk_mail', COPPER),
  trousers('greaves_mail', COPPER),
  helm('helm_iron', METAL, true),
  mail('cuirass_iron', METAL),
  trousers('greaves_iron', METAL),
  ring('ring_silver', STEEL, WATER),
  amulet('amulet_bone', WOOD, CREAM),
  charm('charm_sun', GOLD),
  belt('belt_leather', LEATHER),
  ring('band_iron', METAL, STONE),
  pick('pick_copper', COPPER),
  pick('pick_iron', METAL),
  axe('axe_copper', COPPER),
  axe('axe_iron', METAL),
  sickle('sickle_copper', COPPER),
  sickle('sickle_iron', METAL),
  rod('rod_ash', WOOD),
  rod('rod_yew', GOLD),
  hammer('hammer_copper', COPPER),
  hammer('hammer_iron', METAL),
  berries('nightshade', VIOLET),
  mushroom('glowcap', WATER),
  fiber('hide_rough', WOOD),
  fiber('leather_strip', LEATHER),
  cloth('leather', LEATHER),
  ore('copper_ore', COPPER),
  ore('iron_ore', RUST),
  ore('coal', [0, 0, 1, 1]),
  ingot('copper_ingot', COPPER),
  ingot('iron_ingot', METAL),
  gem('quartz', CREAM),
  log('oak_log', WOOD, GOLD),
  log('ash_log', STONE, CREAM),
  plank('oak_plank', WOOD),
  plank('ash_plank', CREAM),
  fiber('flax_fiber', GOLD),
  fiber('wool_tuft', CREAM),
  cloth('linen_cloth', CREAM),
  cloth('wool_cloth', STONE),
  cloth('silk_cloth', SILK),
  dust('clay', STONE),
  dust('salt', CREAM),
  dust('spark_dust', FIRE),
  bottle('dew_vial', WATER),
  orb('essence_ember', FIRE),
  orb('essence_tide', WATER),
  orb('essence_gale', CREAM),
  orb('essence_stone', STONE),
  icon('roast_meat', (im) => {
    disc(im, 6, 6, 3, WOOD);
    im.rect(3, 5, 8, 7, WOOD[2]);
    im.rect(4, 4, 5, 4, GOLD[3]);
    line(im, 8, 8, 10, 10, CREAM[3]);
    im.set(9, 10, CREAM[3]);
  }),
  bowl('mushroom_soup', WOOD),
  bowl('sunwort_porridge', GOLD),
  icon('trail_biscuit', (im) => {
    im.rect(2, 3, 9, 8, GOLD[2]);
    im.rect(2, 3, 9, 3, GOLD[3]);
    im.rect(2, 8, 9, 8, GOLD[1]);
    im.set(4, 5, GOLD[1]);
    im.set(7, 6, GOLD[1]);
    im.set(5, 7, GOLD[1]);
  }),
  fish('fish_baked', GOLD),
  icon('spiced_cider', (im) => {
    im.rect(3, 3, 8, 9, WOOD[2]);
    im.rect(3, 3, 4, 9, WOOD[3]);
    im.rect(4, 4, 7, 5, FIRE[2]);
    im.rect(9, 4, 10, 7, WOOD[2]);
    im.rect(9, 5, 9, 6, null);
    im.set(5, 1, STONE[3]);
  }),
  pie('apple_tart', GOLD, FIRE),
  bottle('potion_health_s', ROSE),
  bottle('potion_health_m', FIRE),
  bottle('potion_stamina', LEAF),
  bottle('potion_focus', WATER),
  flask('potion_swift', GOLD),
  flask('potion_ward', STONE),
  flask('potion_clarity', VIOLET),
  flask('potion_vigor', FIRE),
  icon('flute_reed', (im) => {
    line(im, 1, 9, 10, 3, LEAF[2]);
    line(im, 1, 10, 10, 4, LEAF[1]);
    im.set(4, 7, STONE[0]);
    im.set(6, 6, STONE[0]);
    im.set(8, 4, STONE[0]);
  }),
  icon('whetstone', (im) => {
    im.rect(2, 4, 9, 8, STONE[2]);
    im.rect(2, 4, 9, 4, STONE[3]);
    im.rect(4, 6, 7, 6, STONE[1]);
  }),
  icon('thread_spool', (im) => {
    im.rect(3, 2, 8, 3, WOOD[2]);
    im.rect(3, 9, 8, 10, WOOD[2]);
    im.rect(4, 4, 7, 8, ROSE[2]);
    im.rect(4, 4, 5, 8, ROSE[3]);
    im.rect(7, 4, 7, 8, ROSE[1]);
  }),
  icon('chalk_stub', (im) => {
    im.rect(4, 3, 7, 9, CREAM[3]);
    im.rect(4, 3, 5, 9, CREAM[2]);
    im.rect(6, 9, 7, 9, CREAM[1]);
  }),
];
