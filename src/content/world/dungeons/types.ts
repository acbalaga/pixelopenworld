import type { StampV2 } from '../../../sim/world/stamp';

/** A tile inside a room, in the room stamp's own coordinates. */
export interface Tile {
  x: number;
  y: number;
}

/**
 * One room of a dungeon: a v2 stamp (its objects are fixtures by kind: blocks, plates, gates,
 * chests, torches) plus the flags the runtime and the validator read. A room is one chunk or
 * smaller, so it fits the portrait view.
 */
export interface DungeonRoom {
  id: string;
  stamp: StampV2;
  /** Dark until a torch is lit here or the avatar carries a lantern. */
  dark?: true;
  /** Blocks of an unsolved puzzle go back to their start on entry. A room without it must have no soft lock. */
  reset?: true;
  /** Item ids of keys lying in this room (in chests or on the floor). The validator needs to know where keys are. */
  keys?: readonly string[];
  /** Reached only from outside by a back door, never from inside: the reachability check leaves it out. */
  outsideOnly?: true;
  /** Where the avatar stands on arrival from outside the dungeon, for the entrance room. */
  start?: Tile;
}

/**
 * How two rooms join. `open` and `locked` doors work both ways. `oneWay` (a drop) and `shortcut`
 * (a gate that opens from one side) work only from `from` to `to`. A `locked` edge needs its
 * `key`. Any edge may name a `skill` that an alternate route needs (Stealth, Athletics...), which
 * must be in the dungeon's declared skill set to count as passable.
 */
export interface DungeonEdge {
  from: string;
  to: string;
  kind: 'open' | 'locked' | 'oneWay' | 'shortcut';
  /** Where the avatar stands to take it, in the `from` room, and where it lands in the `to` room. */
  at: Tile;
  arrive: Tile;
  key?: string;
  skill?: string;
}

/** A dungeon: the room graph, the entrance and the skills a tier-appropriate character has. */
export interface DungeonDef {
  id: string;
  /** Skills a character at this dungeon's tier is assumed to have. The validator uses only these. */
  skills: readonly string[];
  entrance: string;
  rooms: readonly DungeonRoom[];
  edges: readonly DungeonEdge[];
  /** The boss, by boss id (`creatures/bosses`). Its defeat or resolution clears the dungeon. */
  boss?: string;
  /** The region it belongs to, and minutes a first clear takes, for the pacing ledger (M4-12). */
  region?: string;
  estMinutes?: number;
  /** A mini-dungeon: counted under its own line in the pacing ledger (regions/01 section 8). */
  mini?: true;
}
