/**
 * World events and the calendar (POW-M5-11, design/07 World events). Every number is data. Times
 * are local real minutes: an event's slots are `offset + n * period`, and it runs `duration` minutes
 * from each. The day offset of a weekly event counts from 1970-01-01, a Thursday.
 */
export interface EventSchedule {
  period: number;
  offset: number;
  /** A per-save shift of 0 to this many minutes, from the world seed. */
  jitter: number;
  duration: number;
  /** Minutes before the start that the System channel announces it. */
  announce: number;
}

export const EVENT_KINDS = ['raid', 'invasion', 'market', 'maintenance'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const SCHEDULES: Readonly<Record<EventKind, EventSchedule | null>> = {
  /** Field raid: four a real day. */
  raid: { period: 360, offset: 90, jitter: 60, duration: 20, announce: 10 },
  /** Settlement invasion: every real evening. */
  invasion: { period: 1440, offset: 18 * 60, jitter: 60, duration: 12, announce: 10 },
  /** Market day: Saturdays, 08:00 to 20:00. */
  market: {
    period: 7 * 1440,
    offset: 2 * 1440 + 8 * 60,
    jitter: 0,
    duration: 12 * 60,
    announce: 30,
  },
  /** "Maintenance": the mechanism exists, nothing is scheduled yet (M10 fills it). */
  maintenance: null,
};

export const RAID = {
  /** The field boss raids bring, and its Health and power against the base creature. */
  boss: 'creature.hollowhorn',
  hpScale: 3,
  powerScale: 1.2,
  /** Real minutes the parties muster at the north gate before walking out together. */
  musterMin: 3,
  /** Raid parties: how many, and how big. Iron Oath members are asked first. */
  parties: 3,
  partySize: [3, 5] as readonly [number, number],
  firstGuild: 1,
  /** The boss is made real when the player comes within this many px of the site. */
  nearPx: 420,
  /** Pay to the player by their share of the damage: at least `minPct` of the boss's Health dealt. */
  minPct: 3,
  coin: [40, 160] as readonly [number, number],
  /** When the player is not there, the Travelers bring it down with this chance. */
  abstractWin: 0.7,
} as const;

export const INVASION = {
  /** Creatures that come, and how many at each gate, in waves. */
  creatures: [
    'creature.mossling',
    'creature.grain_rat',
    'creature.bramble_boar',
  ] as readonly string[],
  perGate: 2,
  waves: 3,
  /** Real minutes between waves. */
  waveMin: 3,
  /** Renown for each invader the player brings down, and the most one invasion gives. */
  renownPerKill: 1,
  renownCap: 12,
  /** Invaders are made when the player is within this many px of Hearthford's middle. */
  nearPx: 700,
} as const;
