/**
 * Map tunables (POW-M4-06). Fog is kept per 4 x 4 tile block, one bit each, so a chunk is 8 x 8
 * blocks and 64 bits. Everything the player can feel about exploring lives here.
 */
export const MAP_BALANCE = {
  /** Tiles along one edge of a fog block. */
  blockTiles: 4,
  /**
   * Reveal radius in blocks by Cartography points: the last row whose `from` is at or below the
   * points applies. The widest radius stays inside the loaded window (two chunks, 16 blocks), so
   * every block it touches has its chunk resident.
   */
  radius: [
    { from: 0, blocks: 3 },
    { from: 15, blocks: 4 },
    { from: 30, blocks: 5 },
    { from: 50, blocks: 7 },
    { from: 75, blocks: 9 },
    { from: 100, blocks: 11 },
  ],
  /** Cartography XP for each block revealed for the first time. */
  xpPerBlock: 1,
  /**
   * Blocks uncovered, across every region, before Cartography awakens (owner decision 2026-11-27).
   * The first look around a wake point uncovers about 29, so the skill no longer wakes before the
   * player has moved. 150 is a first deliberate wander, about 70 tiles out. The reveal that
   * reaches it pays for every block so far, so Cartography XP still equals blocks revealed.
   */
  awakenBlocks: 150,
  /** Player notes: most kept, and the longest text. */
  notes: { max: 40, maxLength: 40 },
  /**
   * Rumor marks (design/02): the most a mark can sit from the true spot, in tiles, at 0 points.
   * It shrinks in a straight line and is gone at `preciseAt` points (Cartographer Royal, 75).
   */
  rumor: { maxOffsetTiles: 48, preciseAt: 75 },
  /** The map image: tiles per map pixel (one pixel is a 2 x 2 tile cell). */
  cellTiles: 2,
  /** Minimap: cells shown each side of the avatar, and its edge in logical px. */
  mini: { halfCells: 24, size: 48 },
} as const;

/** The widest reveal radius, in blocks. */
export const MAX_REVEAL_BLOCKS = MAP_BALANCE.radius[MAP_BALANCE.radius.length - 1]?.blocks ?? 0;
