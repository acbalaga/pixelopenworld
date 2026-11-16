import type { AtlasGroup, SpriteDef, TileDef } from '../../src/content/sprites/types';
import { encodePng, newImage, put } from './png';
import { pack } from './pack';
import { randomDoll } from '../../src/content/dolls/parts';
import { rng } from '../../src/content/sprites/gen/img';
import { characterSheet, contactSheet, renderFrame, swatchSheet, treeSheet } from './sheets';
import { validateDefs } from './validate';
import { bakeWorld } from './world';

/** Output files by name. Values are bytes or text. */
export type BakeOutput = Map<string, Uint8Array | string>;

const byId = <T extends { id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Validates, packs and renders everything. Pure: no file access, no clock, so two runs give
 * identical bytes. Throws with all validation errors if the definitions are invalid.
 */
export function bakeAll(spritesIn: readonly SpriteDef[], tilesIn: readonly TileDef[]): BakeOutput {
  const errors = validateDefs(spritesIn, tilesIn);
  if (errors.length > 0)
    throw new Error(`asset validation failed:\n${errors.map((e) => `  ${e}`).join('\n')}`);

  const sprites = [...spritesIn].sort(byId);
  const tiles = [...tilesIn].sort(byId);
  const out: BakeOutput = new Map();
  const groups = [...new Set(sprites.map((s) => s.group))].sort() as AtlasGroup[];

  const manifest: {
    version: number;
    atlases: Record<string, { image: string; width: number; height: number }>;
    sprites: Record<string, unknown>;
    tiles: Record<string, TileDef>;
  } = { version: 1, atlases: {}, sprites: {}, tiles: {} };

  for (const group of groups) {
    const members = sprites.filter((s) => s.group === group);
    const items = members.flatMap((s) =>
      Object.keys(s.frames).map((f) => ({ key: `${s.id}#${f}`, w: s.size[0], h: s.size[1] })),
    );
    const { width, height, placed } = pack(items);
    const atlas = newImage(width, height);
    const pos = new Map(placed.map((p) => [p.key, p]));
    for (const s of members) {
      const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const f of Object.keys(s.frames).sort()) {
        const p = pos.get(`${s.id}#${f}`);
        if (!p) throw new Error(`internal: ${s.id}#${f} not placed`);
        const img = renderFrame(s, f);
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const k = (y * img.width + x) * 4;
            if (img.data[k + 3] !== 0)
              put(atlas, p.x + x, p.y + y, [
                img.data[k] as number,
                img.data[k + 1] as number,
                img.data[k + 2] as number,
              ]);
          }
        }
        frames[f] = { x: p.x, y: p.y, w: s.size[0], h: s.size[1] };
      }
      const anims: Record<string, unknown> = {};
      for (const name of Object.keys(s.anims ?? {}).sort()) {
        const a = (s.anims as NonNullable<SpriteDef['anims']>)[name];
        if (a)
          anims[name] = a.flipX
            ? { fps: a.fps, flipX: true, frames: a.frames }
            : { fps: a.fps, frames: a.frames };
      }
      manifest.sprites[s.id] = { anims, frames, group, origin: s.origin, size: s.size };
    }
    manifest.atlases[group] = { height, image: `atlas-${group}.png`, width };
    out.set(`atlas-${group}.png`, encodePng(atlas));
    const isDoll = (s: SpriteDef): boolean => s.id.startsWith('doll.');
    const isNature = (s: SpriteDef): boolean => /^prop\.(tree|bush|flower)_/.test(s.id);
    const parts: [string, SpriteDef[]][] = [
      [`contact-${group}.png`, members.filter((s) => !isDoll(s) && !isNature(s))],
      [`contact-${group}-nature.png`, members.filter(isNature)],
      [`contact-${group}-doll-layers.png`, members.filter(isDoll)],
    ];
    const nature = members.filter(isNature);
    if (nature.some((s) => s.id.includes('tree_')))
      out.set(`contact-${group}-trees.png`, encodePng(treeSheet(nature)));
    for (const [name, list] of parts)
      if (list.length > 0) out.set(name, encodePng(contactSheet(list)));
  }
  for (const t of tiles) manifest.tiles[t.id] = t;
  out.set('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  out.set('palette-swatch.png', encodePng(swatchSheet()));
  for (const [name, bytes] of bakeWorld()) out.set(name, bytes);
  if (sprites.some((s) => s.id.startsWith('doll.'))) {
    const r = rng(2024);
    const specs = Array.from({ length: 18 }, () => randomDoll(r));
    out.set(
      'contact-characters.png',
      encodePng(characterSheet(specs, new Map(sprites.map((s) => [s.id, s])))),
    );
  }
  return out;
}
