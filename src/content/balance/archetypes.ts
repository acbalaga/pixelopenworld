/** Behavior archetype tunables (design/04 Enemies, POW-M4-05). Times are sim ticks (30 per second). */
export const ARCHETYPE = {
  /** Skirmisher: after a strike it backs off, then comes in again. */
  skirmisher: {
    retreatTicks: 24,
    retreatSpeedPct: 130,
  },
  /** Burrower: tunnels under ground, then rises to strike and sinks again. */
  burrower: {
    /** Tunnels at this percent of its walking speed. */
    tunnelSpeedPct: 150,
    /** Rises when it is this close to its target, px. */
    surfaceDist: 22,
    /** Ticks it spends tunnelling in place under the target before it rises. */
    digTicks: 12,
    /** Ticks it stays up for before it sinks again if it has not struck. */
    exposedTicks: 60,
  },
} as const;
