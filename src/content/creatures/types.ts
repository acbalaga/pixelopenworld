/** Creature data types. Pure types, so the client never pulls in zod (the schema is build-time). */

/**
 * The behavior archetypes built so far. The full set of 12 arrives with later milestones.
 *
 * - chaser: runs at its target and strikes.
 * - skirmisher: strikes, then backs off before coming in again.
 * - guard: holds ground within its `tether` of home and never follows past it.
 * - swarm: small and many. One that notices alerts every packmate within its pack radius.
 * - flyer: crosses water, cliffs and walls.
 * - burrower: tunnels toward its target unhurtable, rises to strike, sinks again.
 */
export type Archetype =
  | 'chaser'
  | 'shooter'
  | 'charger'
  | 'dummy'
  | 'skirmisher'
  | 'guard'
  | 'swarm'
  | 'flyer'
  | 'burrower';

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

/**
 * How a creature decides whether and when to attack (design/04, D20). Hostile attacks on notice.
 * Territorial warns inside its territory, then attacks. Defensive fights only when hit. Skittish
 * runs. Passive never fights. Curious follows, and fights only when hit.
 */
export type Temperament =
  'hostile' | 'territorial' | 'defensive' | 'skittish' | 'passive' | 'curious';

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
  /** How it decides to fight. Read by the AI before it can start a chase. */
  temperament: Temperament;
  /** Replaces `temperament` from dusk to dawn. */
  night?: Temperament;
  /** Members of one pack id within `radius` px of a member that is hit are provoked too. */
  pack?: { id: string; radius: number };
  /**
   * Territorial: a target inside `radius` px of the creature's home starts a warning, and a target
   * still inside after `warnTicks` is chased.
   */
  territory?: { radius: number; warnTicks: number };
  /** Curious: stops this many px from its target and follows from there. */
  approach?: number;
  /** Guard: the farthest, px, from home it will follow a target. Beyond that it lets go. */
  tether?: number;
  /** Runs away below this Health percent, if set. Skittish: fights below it instead. */
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
  /** Dungeon enemies: once all are down they return on the next in-game day, at dawn, not on a timer (M4-08). */
  daily?: boolean;
  /** A boss spawner: makes this boss (`creatures/bosses`) in place of the plain creature. */
  boss?: string;
  /** Zone spawners (M4-05): the step whose multipliers scale what it makes. */
  step?: 'a' | 'b' | 'c';
  /** Zone spawners: fills only by day (dawn, day) or only by night (dusk, night). Absent: always. */
  when?: 'day' | 'night';
}
