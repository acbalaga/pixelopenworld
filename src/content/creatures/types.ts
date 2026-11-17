/** Creature data types. Pure types, so the client never pulls in zod (the schema is build-time). */

/** The behavior archetypes built so far. The full set of 12 arrives with later milestones. */
export type Archetype = 'chaser' | 'shooter' | 'charger' | 'dummy';

/** One attack a creature can use, with when it will choose it. */
export interface CreatureAttack {
  /** Attack id in `content/combat/attacks`. Its `windup` is the telegraph. */
  attack: string;
  /** Starts the attack when the target is within this many px. */
  range: number;
  /** Ticks before this creature may use it again. */
  cooldown: number;
  /** Only used from this phase on. 0 is always. */
  phase?: number;
}

/** What a creature may drop. Item ids are defined with items (M1-05). */
export interface DropDef {
  item: string;
  /** Percent chance, 0 to 100. */
  chance: number;
  min: number;
  max: number;
}

/** A change at a Health threshold. Phases only add things, they never remove them. */
export interface PhaseDef {
  /** Enters when Health falls to this percent. */
  hpPct: number;
  /** Speed multiplier in percent from this phase on. */
  speedPct: number;
}

/** A creature. Archetype plus stats, telegraph timings (through its attacks), drops and sounds. */
export interface CreatureDef {
  id: string;
  /** Name on the lock frame. */
  name: string;
  archetype: Archetype;
  /** 1 to 8. Sets the minimum telegraph. */
  tier: number;
  hp: number;
  defense: number;
  power: number;
  /** Walking speed, sub-pixel units per tick. 0 for a creature that does not move. */
  speed: number;
  /** Sees the avatar within this many px. */
  notice: number;
  /** Gives up the chase beyond this many px from itself to the target. */
  lose: number;
  /** Returns home and resets when it is this far from where it started. */
  leash: number;
  /** Runs away below this Health percent, if set. */
  fleeHpPct?: number;
  /** Shooters keep within this band of distance, px. */
  keepRange?: { min: number; max: number };
  /** Wanders near home while idle. */
  wander: boolean;
  staggerMax: number;
  /** Body size, px. */
  bodyW: number;
  bodyH: number;
  /** Sprite id. */
  sprite: string;
  attacks: readonly CreatureAttack[];
  phases?: readonly PhaseDef[];
  drops: readonly DropDef[];
  /** Sound effect ids. */
  sounds: { notice: string; die: string };
}

/** A placed spawner: keeps up to `cap` of a creature alive near a point. */
export interface SpawnerDef {
  /** Object kind used in map data, for example `spawner.mossling`. */
  kind: string;
  creature: string;
  cap: number;
  /** Ticks between respawns once below the cap. */
  respawn: number;
  /** Spawns within this many px of the spawner. */
  radius: number;
}
