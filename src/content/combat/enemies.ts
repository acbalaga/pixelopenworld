/** Combat stats for creatures. The slice map (M1-07) and the creature content (M1-03) extend this. */
export interface EnemyDef {
  id: string;
  /** String key for the name shown on the lock frame. */
  name: string;
  hp: number;
  defense: number;
  power: number;
  weapon: string;
  staggerMax: number;
  /** Body size, px. */
  bodyW: number;
  bodyH: number;
}

export const ENEMIES: Readonly<Record<string, EnemyDef>> = {
  /** The par common enemy: time to kill 4 to 8 seconds at par (design/04). */
  'creature.mossling': {
    id: 'creature.mossling',
    name: 'Mossling',
    hp: 110,
    defense: 5,
    power: 8,
    weapon: 'claws',
    staggerMax: 40,
    bodyW: 12,
    bodyH: 8,
  },
};
