import { TRANSPARENT } from '../content/sprites/grid';
import { DOLL_SIZE, type DollLayerRef } from '../content/dolls/parts';

/** Supplies a layer's frame as palette indices (255 transparent). */
export type LayerProvider = (layerId: string, frame: string) => Uint8Array;

const [W, H] = DOLL_SIZE;
const OUTLINE = 0;

/** Maps slot indices 4 to 7 through the layer's ramp. Everything else is a fixed color. */
export function recolor(index: number, ramp: DollLayerRef['ramp']): number {
  return index >= 4 && index <= 7 ? (ramp[index - 4] as number) : index;
}

/**
 * Draws a 1 px outline in the darkest neutral around the silhouette. On the lit (top and left)
 * side, every third outline pixel is left out, so the light edge breaks up (art bible rule 2).
 */
export function addOutline(px: Uint8Array): Uint8Array {
  const out = px.slice();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[y * W + x] !== TRANSPARENT) continue;
      const solid = (dx: number, dy: number): boolean => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && px[ny * W + nx] !== TRANSPARENT;
      };
      const right = solid(1, 0);
      const below = solid(0, 1);
      const left = solid(-1, 0);
      const above = solid(0, -1);
      if (!(right || below || left || above)) continue;
      const litSide = right || below;
      if (litSide && !left && !above && (x + y) % 3 === 0) continue;
      out[y * W + x] = OUTLINE;
    }
  }
  return out;
}

/** Composes one frame of a character: layers in order, recolored, then outlined. */
export function composeFrame(
  provider: LayerProvider,
  layers: readonly DollLayerRef[],
  frame: string,
): Uint8Array {
  const out = new Uint8Array(W * H).fill(TRANSPARENT);
  for (const layer of layers) {
    const src = provider(layer.id, frame);
    for (let i = 0; i < src.length; i++) {
      const v = src[i] as number;
      if (v !== TRANSPARENT) out[i] = recolor(v, layer.ramp);
    }
  }
  return addOutline(out);
}
