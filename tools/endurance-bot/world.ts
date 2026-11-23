/**
 * Endurance bots: shared loader for the real baked Dawnmeadow. Reads the same chunk files the
 * client streams, so the bots walk the shipped geometry, not a test field.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { FIXTURES } from '../../src/content/world/fixtures';
import { CHUNK_TILES, decodeChunk, Solid } from '../../src/sim/world/chunk';
import { TileWorld } from '../../src/sim/world/world';

export const REGION = 'dawnmeadow';
const DIR = `baked/world/${REGION}`;

export interface Portal {
  kind: string;
  x: number;
  y: number;
  to: string;
  locked: boolean;
}

export interface Loaded {
  grid: TileWorld;
  w: number;
  h: number;
  /** Every object in the baked chunks, as region tiles. */
  objects: { kind: string; x: number; y: number }[];
  portals: Portal[];
}

export function loadDawnmeadow(): Loaded {
  const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as {
    chunks: { w: number; h: number };
  };
  const grid = new TileWorld();
  const objects: Loaded['objects'] = [];
  for (const f of readdirSync(DIR)) {
    if (!/^chunk-\d+-\d+\.bin$/.test(f)) continue;
    const c = decodeChunk(new Uint8Array(readFileSync(`${DIR}/${f}`)));
    grid.set(c);
    for (const o of c.objects)
      objects.push({ kind: o.kind, x: c.cx * CHUNK_TILES + o.x, y: c.cy * CHUNK_TILES + o.y });
  }
  const portals: Portal[] = [];
  for (const o of objects) {
    const def = FIXTURES[o.kind];
    if (def?.type === 'portal' && def.to)
      portals.push({ kind: o.kind, x: o.x, y: o.y, to: def.to, locked: !!def.unlockedBy });
  }
  return {
    grid,
    w: manifest.chunks.w * CHUNK_TILES,
    h: manifest.chunks.h * CHUNK_TILES,
    objects,
    portals,
  };
}

export const walkable = (g: TileWorld, x: number, y: number): boolean =>
  g.solidAt(x, y) === Solid.None;
