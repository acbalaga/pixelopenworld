import type { RegionSpec } from '../../../src/content/world/regions/types';
import { FILL_BIOMES, scatterIds } from '../../../src/content/world/fill';
import { Grid } from '../grid';
import { pickWeighted, roll } from '../rng';
import { MASK_CELL } from './terrain';

const SALT = { detail: 11, detailPick: 12, object: 21, objectPick: 22 } as const;

/**
 * Trees, bushes, rocks and flowers by biome, on tiles nothing else claimed. A tile that is
 * protected (stamp, road, river, bank, cliff) or has an object already is left alone.
 */
export function fillScatter(spec: RegionSpec, g: Grid): void {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = g.at(x, y);
      if (g.protect[i] !== 0 || g.object[i] !== 0) continue;
      const id =
        spec.biomeLegend[
          (spec.biomes[Math.floor(y / MASK_CELL)] as string)[Math.floor(x / MASK_CELL)] as string
        ];
      const biome = id ? FILL_BIOMES[id] : undefined;
      if (!biome) continue;
      if (g.ground[i] !== biome.ground) continue;
      if (roll(spec.seed, x, y, SALT.object) < biome.objectRate) {
        const e = scatterIds(pickWeighted(biome.objects, roll(spec.seed, x, y, SALT.objectPick)));
        g.object[i] = e.object;
        g.overhead[i] = e.overhead;
        if (e.detail) g.detail[i] = e.detail;
        continue;
      }
      if (g.detail[i] === 0 && roll(spec.seed, x, y, SALT.detail) < biome.detailRate) {
        g.detail[i] = scatterIds(
          pickWeighted(biome.details, roll(spec.seed, x, y, SALT.detailPick)),
        ).detail;
      }
    }
  }
}
