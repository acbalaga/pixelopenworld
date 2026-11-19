import { TRANSPARENT } from '../content/sprites/grid';
import { DOLL_SIZE, type DollLayerRef, type Height } from '../content/dolls/parts';
import { headOf } from '../content/dolls/poses';

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

/** The leg row that is cut or doubled to change height. Every pose has legs through it. */
const LEG_ROW = 24;

/** How far the figure's feet move, so the sprite's origin can follow and the feet stay on the ground. */
export function heightShift(height: Height): number {
  return height === 'short' ? -1 : height === 'tall' ? 1 : 0;
}

/**
 * Height is leg length (M4-19). A short body loses a row of leg and a tall one gains a row. The
 * head and torso do not move, so the headroom above the figure is the same for everyone, and the
 * feet end one row higher or lower. The sprite's origin moves with them (`heightShift`), so the
 * feet stay on the ground. The sim's body box does not change.
 */
export function applyHeight(px: Uint8Array, height: Height): Uint8Array {
  if (height === 'mid') return px;
  const out = new Uint8Array(W * H).fill(TRANSPARENT);
  for (let y = 0; y < H; y++) {
    // A tall figure in a pose that already reaches the bottom loses its last boot row, so the
    // outline stays on the canvas.
    if (height === 'tall' && y > H - 3) continue;
    let src: number;
    if (height === 'short') src = y < LEG_ROW ? y : y + 1;
    else src = y <= LEG_ROW ? y : y - 1;
    if (src >= 0 && src < H) out.set(px.subarray(src * W, src * W + W), y * W);
  }
  return out;
}

/** Draws a head stamp's pixels at the head's place in this frame. */
function drawStamp(out: Uint8Array, layer: DollLayerRef, frame: string): void {
  if (!layer.stamp) return;
  const { dir, dx, dy } = headOf(frame);
  for (const [x, y, slot] of layer.stamp[dir]) {
    const px = x + dx;
    const py = y + dy;
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const tip = layer.tip && (slot === 6 || slot === 7);
    out[py * W + px] = recolor(slot, tip ? (layer.tip as DollLayerRef['ramp']) : layer.ramp);
  }
}

/** Composes one frame of a character: layers in order, recolored, then outlined. */
export function composeFrame(
  provider: LayerProvider,
  layers: readonly DollLayerRef[],
  frame: string,
  height: Height = 'mid',
): Uint8Array {
  let out: Uint8Array = new Uint8Array(W * H).fill(TRANSPARENT);
  const paint = (layer: DollLayerRef): void => {
    if (layer.stamp) {
      drawStamp(out, layer, frame);
      return;
    }
    const src = provider(layer.id, frame);
    for (let i = 0; i < src.length; i++) {
      const v = src[i] as number;
      if (v === TRANSPARENT) continue;
      const tip = layer.tip && (v === 6 || v === 7);
      out[i] = recolor(v, tip ? (layer.tip as DollLayerRef['ramp']) : layer.ramp);
    }
  };
  // The body changes height. What is held stays in the hand, which does not move.
  for (const layer of layers) if (layer.kind !== 'main' && layer.kind !== 'off') paint(layer);
  out = applyHeight(out, height);
  for (const layer of layers) if (layer.kind === 'main' || layer.kind === 'off') paint(layer);
  return addOutline(out);
}
