/**
 * An error found while baking a region. It names the source (a region spec or a stamp), the layer
 * and the tile coordinate, so an author can go straight to the cell. Pure data, no side effects.
 */
export class BakeError extends Error {
  constructor(
    /** Where it was found, for example `region sample spec` or `stamp house`. */
    readonly source: string,
    /** The layer or part of the source, for example `ground`, `biomes`, `roads`. */
    readonly layer: string,
    /** What went wrong, in one line. */
    readonly detail: string,
    /** Tile coordinate in the source's own space, when there is one. */
    readonly at?: { x: number; y: number },
  ) {
    super(`${source}: ${layer}${at ? ` at ${at.x},${at.y}` : ''}: ${detail}`);
    this.name = 'BakeError';
  }
}
