import type { Archetype, TieKind, VoiceId } from '../travelers/types';

/**
 * Chat content types (POW-M5-05, design/12 section 4). Templates, voices, glyphs and rumors are
 * data. The engine in `src/sim/chat/` fills and voices them. Text here never names a thing the
 * game does not have: the validator in `validate.ts` holds every template to that.
 */

export const CATEGORIES = [
  'lfg',
  'trade',
  'brag',
  'question',
  'answer',
  'joke',
  'banter',
  'weather',
  'event',
  'deed',
  'greet',
  'farewell',
  'afk',
  'complaint',
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * What a line asks of the player, when its category is too broad to say. A template with an
 * `answers` intent offers the chips of that intent instead of its category's. `askHow` is a
 * question about how the player did something, `strange` is a Traveler puzzled by an odd thing
 * (the player can only shrug: no Traveler knows), `howGoes` asks how the player is, and `yesNo`
 * asks something the player answers with yes, not yet or maybe.
 */
export const CHIP_INTENTS = ['askHow', 'strange', 'howGoes', 'yesNo'] as const;
export type ChipIntent = (typeof CHIP_INTENTS)[number];

/** What can make a template speak: a sim event, or a state the engine reads. */
export const TRIGGERS = [
  'travelerLooted',
  'travelerCrafted',
  'travelerSold',
  'travelerRankUp',
  'travelerDied',
  'travelerArrived',
  'travelerLoggedIn',
  'travelerLoggedOut',
  'state.weather',
  'state.phase',
  /** A crop in season (M6-02): `{item}` is one that can be planted now. */
  'state.season',
  'state.idle',
  'state.afk',
  'state.lfg',
  'state.question',
  'state.answer',
  /** A generic nod to a public deed of the player. */
  'playerDeed',
  /** The player's public deeds that exist today (M5-15): a boss resolved, a Trial passed, a rank, a Singular. */
  'deed.boss',
  'deed.trial',
  'deed.rank',
  'deed.singular',
  /** The player passed a Traveler on a board. Emitted by the rankings ticket (M5-09). */
  'deed.passed',
  /** A market price rose or fell far enough to talk about (M5-10, `priceMoved`). */
  'price.up',
  'price.down',
  /** World events (M5-11): a raid, an invasion or a market day began; a raid was won or lost. */
  'world.raid',
  'world.invasion',
  'world.market',
  'world.raidWon',
  'world.raidLost',
] as const;
export type Trigger = (typeof TRIGGERS)[number];

/** The slots a template may use (design/12 4.2). */
export const SLOT_NAMES = [
  'item',
  'qty',
  'price',
  'place',
  'creature',
  'skill',
  'rank',
  'handle',
  'player',
  'dungeon',
  'weather',
  'time',
  /** A line from the rumor table, for answers only. */
  'rumor',
] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** Conditions on the speaker and the world. Anything listed must hold. */
export interface When {
  archetype?: readonly Archetype[];
  voice?: readonly VoiceId[];
  weather?: readonly string[];
  /** In-game day phases: dawn, day, dusk, night. */
  phase?: readonly string[];
  /** Only these hand-tuned Travelers say it (their own lines, design/12 section 6). */
  handle?: readonly string[];
  /** Only while the speaker is doing one of these activities (design/12 3.2). */
  doing?: readonly string[];
  /** Only while the speaker is at one of these places and has arrived (ids from the places table). */
  place?: readonly string[];
}

export interface ChatTemplate {
  id: string;
  category: Category;
  channel: 'world' | 'local';
  trigger: Trigger;
  when?: When;
  /** Alternatives, one chosen. Slots in braces. */
  text: readonly string[];
  weight: number;
  /** In-game minutes before the same speaker may use this template again. */
  cooldownMin: number;
  /** For a question: the kind of rumor that answers it. */
  topic?: Rumor['about'];
  /** What the line asks of the player, when its category does not say (picks the reply chips). */
  answers?: ChipIntent;
}

/** A two-to-five line exchange between two Travelers with a tie (design/12 4.5). */
export interface ChatExchange {
  id: string;
  tie: TieKind;
  /** Only these two hand-tuned Travelers say it: `a` is the first handle, `b` the second. */
  between?: readonly [string, string];
  lines: readonly { role: 'a' | 'b'; text: string }[];
  weight: number;
}

/** A hint or rumor a Traveler can repeat. About one in four is wrong, and none is costly (4.6). */
export interface Rumor {
  id: string;
  /** What it is about, for the question that asks for it. */
  about: 'recipe' | 'creature' | 'place' | 'tip';
  text: string;
  true: boolean;
  /** A trail rumor (POW-M5-29): told only once the player's journal has every flag in `needs`, and sets `sets` when heard. */
  gate?: { needs: readonly string[]; sets: string };
}

export interface Glyph {
  id: string;
  /** Eight rows of eight: `.` clear, `#` ink, `o` outline. */
  rows: readonly string[];
  /** Palette index of the ink. */
  ink: number;
}

export interface VoiceDef {
  id: VoiceId;
  /** Whole-word swaps, case-insensitive. */
  lexicon: Readonly<Record<string, string>>;
  case: 'lower' | 'sentence' | 'shout' | 'title';
  punct: 'none' | 'light' | 'full' | 'ellipsis' | 'exclaim';
  /** Chance a line ends with an emoticon or a glyph, and what they are. */
  emoticon: { rate: number; texts: readonly string[]; glyphs: readonly string[] };
  /** Chance a line carries a typo, which kinds, and the chance a `*fix` follows it. */
  typo: { rate: number; kinds: readonly ('swap' | 'double' | 'drop')[]; fix: number };
  /** Said on a farewell. */
  signoff: string;
}

/**
 * A small scene (POW-M5-27): lines said by Travelers while something shows on screen. `wish` is one
 * Traveler at the well, `wishCame` is said later when a real event of theirs follows (`on`), `dance`
 * is a challenge (a), a reply (b) and a judge (c), `ghost` is a story told by two at a camp, and
 * `dummy` is a low-rank Traveler arguing with the training dummy (a), with a friend teasing (b)
 * when the lines have a `b`.
 */
export interface ChatScene {
  id: string;
  kind: 'wish' | 'wishCame' | 'dance' | 'ghost' | 'dummy';
  on?: 'rank' | 'drop';
  lines: readonly { role: 'a' | 'b' | 'c'; text: string }[];
  weight: number;
}
