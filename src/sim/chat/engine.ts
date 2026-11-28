import { CHAT, PIT_RUMOR_BIAS, SCENES as SCENE_BALANCE } from '../../content/balance/chat';
import { FIGHT_AREAS } from '../../content/balance/travelers';
import { CREATURES } from '../../content/creatures';
import { ITEMS } from '../../content/items';
import { FURNITURE_ITEMS } from '../../content/items/furniture';
import { NODES, RECIPES } from '../../content/items/recipes';
import { DUNGEON_NAMES, PLACE_NAMES, TIME_WORDS } from '../../content/chat/names';
import { RUMORS } from '../../content/chat/rumors';
import { SLOTS_BY_TRIGGER } from '../../content/chat/slots';
import { BY_TRIGGER, EXCHANGES } from '../../content/chat/templates';
import type {
  ChatExchange,
  ChatTemplate,
  Rumor,
  SlotName,
  Trigger,
} from '../../content/chat/types';
import { VOICES } from '../../content/chat/voices';
import { ITEM_STRINGS } from '../../content/strings/items';
import { SKILLS } from '../../content/skills';
import { findAvatar } from '../../shared/summary';
import { emit, type SimEvent } from '../kernel/events';
import type { SimState } from '../state';
import { dayPhase, seasonOf, weatherOn } from '../time';
import { CROP_LIST } from '../../content/farming/crops';
import { crowdOf, onlineCount } from '../travelers/crowd';
import { startScene } from '../travelers/entities';
import { addFlag, gateOpen, hasFlag } from '../travelers/pit';
import { mailOnLogin } from './letters';
import { cameTrue, planScenes } from './scenes';
import {
  duelAsks,
  duelEvents,
  friendAsks,
  loginHellos,
  memoryLines,
  offerFor,
  partyEvents,
  pitEvents,
  processInbox,
  memorable,
  recordMemories,
  rivalOnEntry,
  touchNear,
  type Inbox,
  type Offer,
} from './social';
import { hash01 } from '../travelers/dice';
import { identitiesOf } from '../travelers/generate';
import { PLACE_LIST, SKILL_LIST } from '../travelers/lists';
import { dayIndexOf, localMinute, MIN_PER_DAY } from '../travelers/schedule';
import type { TravelerIdentity } from '../travelers/types';
import { applyVoice, glyphsIn } from './voice';
import { guildChatter, guildInvites } from './guild';

/**
 * The chat engine (POW-M5-05, design/12 section 4). It turns real sim events into lines in a
 * Traveler's voice at a believable rate. A line is made from a template whose trigger is an event
 * of this tick or a state the engine reads (the weather, the hour, what a Traveler is doing), a
 * speaker who could have said it, and slots filled only from that event or the speaker's own state.
 * Every line follows a `chatSource` event that names what it came from. The engine has its own
 * dice (a hash, like the entity layer's) and never touches the sim's streams, so chat cannot
 * change what the crowd does. Output is a `travelerSpoke` event.
 */

type Slots = { [K in SlotName]?: string | undefined };
type Channel = 'world' | 'local';
/** Where a line can be said: the two public channels, a whisper to the player, or the party (M5-07). */
type SayChannel = Channel | 'whisper' | 'party' | 'guild';

export interface Queued {
  due: number;
  slot: number;
  channel: SayChannel;
  text: string;
  template: string;
  source: string;
  reply: boolean;
  slots: Record<string, string>;
  /** Reply chips the line offers, for a whisper or a line from social chat. */
  chips?: { id: string; text: string }[];
}

export interface ChatState {
  lastMinute: number;
  tokens: Record<Channel, number>;
  /** Template ids said lately in each channel, newest last, for the no-repeat window. */
  recent: Record<Channel, string[]>;
  lastSpoke: number[];
  cooldown: Map<string, number>;
  queue: Queued[];
  /** A counter for dice and ids. */
  n: number;
  lastWeather: string;
  lastPhase: string;
  /** Small scenes (M5-27): how many ran this real hour by kind, and who made a wish and when. */
  scenes: { counts: Map<string, number>; wished: Map<number, number> };
  /** Social chat (M5-06): chips on offer by Traveler, player commands waiting, requests, memory lines said. */
  offers: Map<number, Offer>;
  inbox: Inbox[];
  asked: Map<number, number>;
  said: Set<number>;
  /** Duel and Rival bookkeeping (M5-12): who has asked for a duel, dungeon entry times, Rival visits. */
  duelAsked: Set<number>;
  lastEntry: Map<string, number>;
  rivalMisses: number;
  rivalHere: Map<number, { dungeon: string; minute: number }>;
  /** Travelers poked awake this session (M5-31). */
  poked: Set<number>;
  /** Guild invitations open, by the Traveler who sent them, to the guild id (M5-08). */
  guildInvites: Map<number, number>;
}

export function newChatState(): ChatState {
  return {
    lastMinute: -1,
    tokens: { world: 1, local: 1 },
    recent: { world: [], local: [] },
    lastSpoke: Array.from({ length: 240 }, () => -1e9),
    cooldown: new Map(),
    queue: [],
    n: 0,
    lastWeather: '',
    lastPhase: '',
    scenes: { counts: new Map(), wished: new Map() },
    offers: new Map(),
    inbox: [],
    asked: new Map(),
    said: new Set(),
    duelAsked: new Set(),
    lastEntry: new Map(),
    rivalMisses: 0,
    rivalHere: new Map(),
    poked: new Set(),
    guildInvites: new Map(),
  };
}

const voiceOf = (id: string): (typeof VOICES)[number] =>
  VOICES.find((v) => v.id === id) as (typeof VOICES)[number];

const itemName = (id: string): string | undefined => {
  const def = ITEMS[id];
  return def ? ITEM_STRINGS[def.nameKey] : undefined;
};

/** One dice for a line: seeded by the world, the minute and a running counter. */
function diceFor(state: SimState, chat: ChatState, salt: number): () => number {
  const seed = state.seed;
  const base = chat.n++;
  let k = 0;
  return () => hash01(seed, salt, base, k++);
}

// Furniture (M6-07) is not something Travelers talk about yet.
const FURNITURE_RESULTS = new Set(FURNITURE_ITEMS.map((i) => i.id));
const craftResults = Object.values(RECIPES)
  .filter((r) => !r.enchant && r.result !== '' && !FURNITURE_RESULTS.has(r.result))
  .map((r) => ({ item: r.result, craft: `skill.${r.craft}` }));
const gatherItems = Object.values(NODES).flatMap((n) =>
  n.yields.map((y) => ({ item: y.item, skill: `skill.${n.tag}` })),
);

/** An item the Traveler could plausibly talk about, from its own focus. */
function itemFor(t: TravelerIdentity, d: () => number): string {
  const mine = [
    ...craftResults.filter((c) => t.focus.includes(c.craft)).map((c) => c.item),
    ...gatherItems.filter((g) => t.focus.includes(g.skill)).map((g) => g.item),
  ];
  const pool = mine.length > 0 ? mine : craftResults.map((c) => c.item);
  return pool[Math.floor(d() * pool.length)] as string;
}

function topRank(state: SimState, t: TravelerIdentity): { skill: string; rank: number } | null {
  let best: [number, number] | null = null;
  for (const [s, p] of state.travelers[t.slot]!.build) if (!best || p > best[1]) best = [s, p];
  if (!best) return null;
  return { skill: SKILL_LIST[best[0]] as string, rank: Math.floor(best[1] / 5) * 5 };
}

export interface Ctx {
  state: SimState;
  chat: ChatState;
  ids: readonly TravelerIdentity[];
  minute: number;
  hour: number;
  tod: number;
  weather: string;
  phase: string;
  player: string;
  /** The real local minute and day index now, for regard and memory. */
  real: number;
  day: number;
}

function placeName(index: number): string | undefined {
  return PLACE_NAMES[PLACE_LIST[index] ?? ''];
}

/** The slots a speaker can fill for a trigger, from its own state and the given facts. */
function slotsFor(
  c: Ctx,
  t: TravelerIdentity,
  trigger: Trigger,
  facts: Slots,
  d: () => number,
): Slots {
  const life = c.state.travelers[t.slot]!;
  const allowed = new Set<string>(SLOTS_BY_TRIGGER[trigger]);
  const out: Slots = { player: c.player, ...facts };
  const put = (k: SlotName, v: string | undefined): void => {
    if (allowed.has(k) && v !== undefined && out[k] === undefined) out[k] = v;
  };
  put('place', placeName(life.place));
  put('time', TIME_WORDS[c.phase]);
  put('weather', c.weather);
  if (allowed.has('handle') && out.handle === undefined) {
    const tie = t.ties[Math.floor(d() * t.ties.length)];
    const other = tie ? c.ids[tie.slot] : undefined;
    const pool = c.ids.filter((x) => x.slot !== t.slot && c.state.crowd!.online[x.slot] === 1);
    out.handle = other?.handle ?? pool[Math.floor(d() * pool.length)]?.handle;
  }
  if (allowed.has('skill') && out.skill === undefined) {
    const r = topRank(c.state, t);
    if (r) {
      out.skill = SKILLS[r.skill]?.name;
      if (allowed.has('rank') && out.rank === undefined) out.rank = String(Math.max(5, r.rank));
    }
  }
  if (allowed.has('item') && out.item === undefined) out.item = itemName(itemFor(t, d));
  if (allowed.has('creature') && out.creature === undefined) {
    const area = FIGHT_AREAS[Math.floor(d() * FIGHT_AREAS.length)]!;
    out.creature = CREATURES[area.creature]?.name;
  }
  if (allowed.has('dungeon') && out.dungeon === undefined) {
    const names = Object.values(DUNGEON_NAMES);
    out.dungeon = names[Math.floor(d() * names.length)];
  }
  return out;
}

/** Fills a template's text with slots. Null if any slot cannot be filled. */
export function fill(text: string, slots: Slots): string | null {
  let ok = true;
  const out = text.replace(/\{([a-z]+)\}/g, (_, name: string) => {
    const v = slots[name as SlotName];
    if (v === undefined) ok = false;
    return v ?? '';
  });
  return ok ? out : null;
}

function eligible(c: Ctx, t: TravelerIdentity, tpl: ChatTemplate, channel?: Channel): boolean {
  if (channel && tpl.channel !== channel) return false;
  const w = tpl.when;
  if (w?.archetype && !w.archetype.includes(t.archetype)) return false;
  if (w?.voice && !w.voice.includes(t.voice)) return false;
  if (w?.weather && !w.weather.includes(c.weather)) return false;
  if (w?.phase && !w.phase.includes(c.phase)) return false;
  if (w?.handle && !w.handle.includes(t.handle)) return false;
  if (w?.doing) {
    const kind = c.state.crowd!.doing[t.slot]?.kind;
    if (kind === undefined || !w.doing.includes(kind)) return false;
  }
  if (w?.place) {
    const d = c.state.crowd!.doing[t.slot];
    if (!d || d.eta > 0 || !w.place.includes(PLACE_LIST[d.place] ?? '')) return false;
  }
  if (tpl.channel === 'local' && !c.state.crowd!.promoted[t.slot]) return false;
  if (c.chat.recent[tpl.channel].includes(tpl.id)) return false;
  if ((c.chat.cooldown.get(`${t.slot}|${tpl.id}`) ?? -1) > c.minute) return false;
  return true;
}

interface Made {
  tpl: ChatTemplate;
  text: string;
  slots: Record<string, string>;
  fix?: string;
}

/** Picks and fills a template for a speaker and trigger, in the speaker's voice. Null if none fits. */
function make(
  c: Ctx,
  t: TravelerIdentity,
  trigger: Trigger,
  facts: Slots,
  opts: { category?: string; skip?: string; ids?: readonly string[] } = {},
): Made | null {
  const d = diceFor(c.state, c.chat, t.slot * 7 + c.minute);
  let pool = (BY_TRIGGER.get(trigger) ?? []).filter(
    (tpl) =>
      eligible(c, t, tpl) &&
      (!opts.category || tpl.category === opts.category) &&
      (!opts.skip || tpl.category !== opts.skip) &&
      (!opts.ids || opts.ids.includes(tpl.id)),
  );
  for (let tries = 0; tries < 5 && pool.length > 0; tries++) {
    const total = pool.reduce((a, p) => a + p.weight, 0);
    let x = d() * total;
    let pick = pool[pool.length - 1]!;
    for (const p of pool) {
      x -= p.weight;
      if (x < 0) {
        pick = p;
        break;
      }
    }
    const slots = slotsFor(c, t, trigger, facts, d);
    const text = pick.text[Math.floor(d() * pick.text.length)] as string;
    const filled = fill(text, slots);
    if (filled === null) {
      pool = pool.filter((p) => p !== pick);
      continue;
    }
    const v = applyVoice(voiceOf(t.voice), filled, pick.category, d);
    const used: Record<string, string> = {};
    for (const m of text.matchAll(/\{([a-z]+)\}/g))
      used[m[1] as string] = slots[m[1] as SlotName] as string;
    return v.fix === undefined
      ? { tpl: pick, text: v.text, slots: used }
      : { tpl: pick, text: v.text, slots: used, fix: v.fix };
  }
  return null;
}

function speak(
  c: Ctx,
  slot: number,
  channel: SayChannel,
  text: string,
  template: string,
  source: string,
  reply: boolean,
  slots: Record<string, string> = {},
  chips?: { id: string; text: string }[],
): void {
  const { state, chat } = c;
  // A Local line from a template can be answered: the chips come from its category and regard.
  const offered = chips ?? (reply ? [] : offerFor(c, slot, template, channel, slots));
  emit(state.events, {
    type: 'travelerSpoke',
    channel,
    slot,
    text,
    glyphs: glyphsIn(text),
    source,
    template,
    reply,
    slots,
    chips: offered,
  });
  if (channel === 'world' || channel === 'local') {
    const r = chat.recent[channel];
    if (!reply && !template.startsWith('exchange.')) r.push(template);
    while (r.length > CHAT.windowLines) r.shift();
  }
  // A trail rumor said aloud is a rumor the player has heard (M5-29).
  if (slots.rumor !== undefined) {
    const heard = RUMORS.find((r) => r.gate !== undefined && r.text === slots.rumor);
    if (heard?.gate) addFlag(state, heard.gate.sets);
  }
  chat.lastSpoke[slot] = state.tick;
  const tpl = template;
  chat.cooldown.set(`${slot}|${tpl}`, c.minute + (cooldownOf(tpl) || 30));
}

const COOLDOWNS = new Map<string, number>();
function cooldownOf(id: string): number {
  if (COOLDOWNS.size === 0)
    for (const list of BY_TRIGGER.values())
      for (const t of list) COOLDOWNS.set(t.id, t.cooldownMin);
  return COOLDOWNS.get(id) ?? 30;
}

/** May this Traveler speak now? Online, and not within the speaker gap unless replying. */
function canSpeak(c: Ctx, slot: number, reply = false): boolean {
  const crowd = c.state.crowd!;
  if (!crowd.online[slot]) return false;
  return reply || c.state.tick - (c.chat.lastSpoke[slot] ?? -1e9) >= CHAT.speakerGapTicks;
}

function source(c: Ctx, id: string, fact: string): string {
  emit(c.state.events, { type: 'chatSource', id, fact });
  return id;
}

function enqueue(c: Ctx, q: Queued): void {
  if (c.chat.queue.length < CHAT.queueCap) c.chat.queue.push(q);
}

/** The topic a question asks about, which picks the rumor that answers it. */
const QUESTION_TOPIC: Record<string, Rumor['about']> = {
  'question.recipe': 'recipe',
  'question.creature': 'creature',
  'question.dungeon': 'place',
  'question.where': 'tip',
  'question.sleep': 'tip',
  'question.fast': 'tip',
  'question.where.local': 'tip',
  'question.price': 'tip',
};

function witnessFor(c: Ctx, not: number): TravelerIdentity | null {
  const crowd = c.state.crowd!;
  const pool = c.ids.filter(
    (x) => x.slot !== not && crowd.promoted[x.slot] === 1 && canSpeak(c, x.slot),
  );
  if (pool.length === 0) return null;
  return pool[
    Math.floor(hash01(c.state.seed, not, c.minute, c.chat.n++) * pool.length)
  ] as TravelerIdentity;
}

/** A public deed of the player in this event, and how likely it is to be remarked on. */
function deedOf(c: Ctx, e: SimEvent): { trigger: Trigger; chance: number } | null {
  const me = findAvatar(c.state);
  if (me === null) return null;
  switch (e.type) {
    case 'bossResolved':
      return e.id === me ? { trigger: 'deed.boss', chance: 0.9 } : null;
    case 'trialPassed':
      return e.id === me ? { trigger: 'deed.trial', chance: 0.7 } : null;
    case 'skillRankUp':
      return e.id === me && e.points % 10 === 0 ? { trigger: 'deed.rank', chance: 0.4 } : null;
    case 'singularDone':
      return e.who === me ? { trigger: 'deed.singular', chance: 0.9 } : null;
    default:
      return null;
  }
}

/** What an event says, if anything: a speaker, a trigger and the facts. */
function fromEvent(c: Ctx, e: SimEvent, index: number): void {
  const { state, chat } = c;
  const id = `ev:${state.tick}:${index}`;
  const room = (ch: Channel): boolean => chat.tokens[ch] >= 1;
  const say = (
    t: TravelerIdentity,
    trigger: Trigger,
    facts: Slots,
    category?: string,
    reply = false,
    skip?: string,
  ): void => {
    const made = make(c, t, trigger, facts, {
      ...(category ? { category } : {}),
      ...(skip ? { skip } : {}),
    });
    if (!made || !room(made.tpl.channel)) return;
    chat.tokens[made.tpl.channel] -= 1;
    speak(c, t.slot, made.tpl.channel, made.text, made.tpl.id, id, reply, made.slots);
    if (made.fix)
      enqueue(c, {
        due: c.minute + 1,
        slot: t.slot,
        channel: made.tpl.channel,
        text: made.fix,
        template: made.tpl.id,
        source: id,
        reply: true,
        slots: {},
      });
  };
  // The player passed a Traveler on a board (M5-09): someone nearby remarks on it, naming them.
  if (e.type === 'playerPassed') {
    const passed = c.ids[e.slot];
    const w = witnessFor(c, e.slot);
    const dd = hash01(state.seed, 0x9a55ed, state.tick, index);
    if (passed && w && dd < 0.6) say(w, 'deed.passed', { handle: passed.handle }, 'deed');
    return;
  }
  // The player's public deeds: someone nearby says something about it (design/12 4.2, M5-15).
  const deed = deedOf(c, e);
  if (deed) {
    const w = witnessFor(c, -1);
    const dd = hash01(state.seed, 0x0deed, state.tick, index);
    if (w && dd < deed.chance) say(w, deed.trigger, {}, 'deed');
    return;
  }
  // A market price moved (M5-10): someone online who trades or crafts says so, now and then.
  if (e.type === 'priceMoved') {
    const dd = hash01(state.seed, 0x9e1ce, state.tick, index);
    if (dd >= 0.5) return;
    const pool = c.ids.filter(
      (x) =>
        state.crowd!.online[x.slot] === 1 &&
        (x.archetype === 'Trader' || x.archetype === 'Crafter' || dd < 0.15) &&
        canSpeak(c, x.slot),
    );
    if (pool.length === 0) return;
    const who = pool[Math.floor(hash01(state.seed, 0x9e1cf, state.tick, index) * pool.length)]!;
    const name = itemName(e.item);
    if (name)
      say(who, e.to > e.from ? 'price.up' : 'price.down', { item: name, price: String(e.to) });
    return;
  }
  // A camp meal (M6-04): one of the party who ate says something about it.
  if (e.type === 'campMeal') {
    const fed = e.slots.filter((s) => canSpeak(c, s));
    const pick = fed[Math.floor(hash01(state.seed, 0xf00d, state.tick, index) * fed.length)];
    const who = pick === undefined ? undefined : c.ids[pick];
    const name = itemName(e.item);
    if (who && name) say(who, 'party.meal', { item: name });
    return;
  }
  if (!('slot' in e) || typeof e.slot !== 'number') return;
  const t = c.ids[e.slot];
  if (!t) return;
  const dice = hash01(state.seed, e.slot, state.tick, index);
  switch (e.type) {
    case 'travelerLoggedIn':
      if (canSpeak(c, e.slot) && dice < 0.35) say(t, 'travelerLoggedIn', {});
      break;
    case 'travelerLoggedOut':
      if (canSpeak(c, e.slot, true) && dice < 0.3) say(t, 'travelerLoggedOut', {});
      break;
    case 'travelerArrived':
      if (canSpeak(c, e.slot) && dice < 0.06)
        say(t, 'travelerArrived', { place: placeName(e.place) ?? '' });
      break;
    case 'travelerLooted':
      // A common drop can be offered for sale, but nobody brags about it (POW-M6-23).
      if (canSpeak(c, e.slot) && dice < 0.7)
        say(
          t,
          'travelerLooted',
          {
            ...(itemName(e.item) ? { item: itemName(e.item) as string } : {}),
            qty: String(e.qty),
            ...(CREATURES[e.creature] ? { creature: CREATURES[e.creature]!.name } : {}),
          },
          undefined,
          false,
          e.chance > CHAT.bragDropPct ? 'brag' : undefined,
        );
      break;
    case 'travelerCrafted':
      if (canSpeak(c, e.slot) && dice < 0.25)
        say(t, 'travelerCrafted', {
          ...(itemName(e.item) ? { item: itemName(e.item) as string } : {}),
          qty: String(e.qty),
          ...(RECIPES[e.recipe] && SKILLS[`skill.${RECIPES[e.recipe]!.craft}`]
            ? { skill: SKILLS[`skill.${RECIPES[e.recipe]!.craft}`]!.name }
            : {}),
        });
      break;
    case 'travelerSold':
      if (canSpeak(c, e.slot) && dice < 0.5)
        say(t, 'travelerSold', {
          ...(itemName(e.item) ? { item: itemName(e.item) as string } : {}),
          qty: String(e.qty),
          price: String(e.price),
        });
      break;
    case 'travelerRankUp':
      if (canSpeak(c, e.slot) && dice < 0.8)
        say(t, 'travelerRankUp', {
          ...(SKILLS[e.skill] ? { skill: SKILLS[e.skill]!.name } : {}),
          rank: String(e.points),
        });
      break;
    case 'travelerDied': {
      const facts: Slots = {
        ...(CREATURES[e.creature] ? { creature: CREATURES[e.creature]!.name } : {}),
        ...(placeName(e.place) ? { place: placeName(e.place) as string } : {}),
      };
      if (canSpeak(c, e.slot, true) && dice < 0.6) say(t, 'travelerDied', facts, 'complaint');
      const w = witnessFor(c, e.slot);
      if (w && dice > 0.3) say(w, 'travelerDied', facts, 'event');
      break;
    }
    default:
      break;
  }
}

/** A crop that can be planted now, by its item name, for a `state.season` line. */
function cropInSeason(c: Ctx, d: () => number): string | undefined {
  const season = seasonOf(c.state.worldTick);
  const pool = CROP_LIST.filter((x) => x.seasons.includes(season) && !x.shade);
  const crop = pool[Math.floor(d() * pool.length)];
  return crop ? itemName(crop.result) : undefined;
}

/** Unprompted talk: the weather, the hour, someone away, someone looking for a group, a question. */
function chatter(c: Ctx): void {
  const { state, chat } = c;
  const crowd = state.crowd!;
  const online = c.ids.filter((x) => crowd.online[x.slot] === 1);
  if (online.length === 0) return;
  const d = diceFor(state, chat, 9000 + c.minute);
  for (let i = 0; i < CHAT.burst; i++) {
    if (chat.tokens.world < 1 && chat.tokens.local < 1) return;
    // A speaker: shy Travelers speak third as often as bold ones.
    const pool = online.filter((x) => canSpeak(c, x.slot));
    if (pool.length === 0) return;
    const wt = (x: TravelerIdentity): number =>
      x.temper === 'shy' ? 0.3 : x.temper === 'bold' ? 1.6 : 1;
    const total = pool.reduce((a, x) => a + wt(x), 0);
    let r = d() * total;
    let t = pool[pool.length - 1]!;
    for (const x of pool) {
      r -= wt(x);
      if (r < 0) {
        t = x;
        break;
      }
    }
    const doing = crowd.doing[t.slot];
    const afk = doing?.kind === 'afk';
    const lfgOk = t.archetype !== 'Casual' && t.archetype !== 'Socializer';
    const options: [Trigger, number, string][] = [
      ['state.idle', 5, `doing:${doing?.kind ?? 'none'}`],
      ['state.weather', c.weather === 'clear' ? 1 : 3, `weather:${c.weather}`],
      ['state.phase', 1.5, `phase:${c.phase}`],
      ['state.lfg', lfgOk ? 1.5 : 0.2, 'looking:group'],
      ['state.question', t.archetype === 'Newbie' ? 3 : 0.8, 'asking'],
    ];
    if (afk) options.push(['state.afk', 6, 'doing:afk']);
    // Crops in season (M6-02): only a Traveler who gathers or crafts talks about them.
    const grows = t.focus.some((f) => {
      const fam = SKILLS[f]?.family;
      return fam === 'gathering' || fam === 'crafting';
    });
    if (grows) options.push(['state.season', 1.2, `season:${seasonOf(state.worldTick)}`]);
    let x = d() * options.reduce((a, o) => a + o[1], 0);
    let chosen = options[0]!;
    for (const o of options) {
      x -= o[1];
      if (x < 0) {
        chosen = o;
        break;
      }
    }
    const [trigger, , fact] = chosen;
    const made = make(
      c,
      t,
      trigger,
      trigger === 'state.season' ? { item: cropInSeason(c, d) } : {},
    );
    if (!made || chat.tokens[made.tpl.channel] < 1) continue;
    chat.tokens[made.tpl.channel] -= 1;
    const src = source(c, `state:${trigger}:${t.slot}:${c.minute}`, fact);
    speak(c, t.slot, made.tpl.channel, made.text, made.tpl.id, src, false, made.slots);
    if (made.fix)
      enqueue(c, {
        due: c.minute + 1,
        slot: t.slot,
        channel: made.tpl.channel,
        text: made.fix,
        template: made.tpl.id,
        source: src,
        reply: true,
        slots: {},
      });
    // A question may be answered, with a rumor that is right three times in four.
    const topic = made.tpl.topic ?? QUESTION_TOPIC[made.tpl.id];
    if (trigger === 'state.question' && topic && d() < CHAT.answerChance) {
      const answerer = witnessOrAny(c, t.slot, d);
      // Rumors of the Pit trail join the pool only once the player's journal has what they need,
      // and are preferred when one can be told (POW-M5-29).
      const told = RUMORS.filter(
        (r2) =>
          r2.about === topic &&
          (!r2.gate || (gateOpen(state, r2.gate.needs) && !hasFlag(state, r2.gate.sets))),
      );
      const trail = told.filter((r2) => r2.gate !== undefined);
      const rumors =
        trail.length > 0 && d() < PIT_RUMOR_BIAS ? trail : told.filter((r2) => !r2.gate);
      if (answerer && rumors.length > 0) {
        const rumor = rumors[Math.floor(d() * rumors.length)] as Rumor;
        const ans = make(c, answerer, 'state.answer', { rumor: rumor.text });
        if (ans) {
          const [lo, hi] = CHAT.replyGapMin;
          enqueue(c, {
            due: c.minute + lo + Math.floor(d() * (hi - lo + 1)),
            slot: answerer.slot,
            channel: ans.tpl.channel,
            text: ans.text,
            template: ans.tpl.id,
            source: source(
              c,
              `state:answer:${answerer.slot}:${c.minute}`,
              `question:${made.tpl.id}`,
            ),
            reply: true,
            slots: { rumor: rumor.text },
          });
        }
      }
    }
  }
}

function witnessOrAny(c: Ctx, not: number, d: () => number): TravelerIdentity | null {
  const crowd = c.state.crowd!;
  const pool = c.ids.filter((x) => x.slot !== not && crowd.online[x.slot] === 1);
  return pool.length === 0 ? null : (pool[Math.floor(d() * pool.length)] as TravelerIdentity);
}

/**
 * The exchanges a pair with a tie of this kind can hold: the generic ones for the tie, and the named
 * ones only between their own two. Pure in its inputs, and exported as a test hook (POW-M6-20).
 */
export function pairPool(kind: string, a: string, b: string): readonly ChatExchange[] {
  return EXCHANGES.filter(
    (x) => x.tie === kind && (!x.between || (x.between.includes(a) && x.between.includes(b))),
  );
}

/** Pairs with a standing tie sometimes talk to each other: a short exchange, a minute apart. */
function exchanges(c: Ctx): void {
  const { state, chat } = c;
  const crowd = state.crowd!;
  const d = diceFor(state, chat, 5000 + c.minute);
  if (d() >= CHAT.exchangeChance * c.tod * 6) return;
  const pairs: { a: TravelerIdentity; b: TravelerIdentity; kind: string }[] = [];
  for (const a of c.ids) {
    if (!crowd.online[a.slot]) continue;
    for (const tie of a.ties) {
      const b = c.ids[tie.slot];
      if (b && b.slot > a.slot && crowd.online[b.slot]) pairs.push({ a, b, kind: tie.kind });
    }
  }
  if (pairs.length === 0) return;
  const free = pairs.filter(
    (p) => (chat.cooldown.get(`pair|${p.a.slot}|${p.b.slot}`) ?? -1) <= c.minute,
  );
  if (free.length === 0) return;
  const pair = free[Math.floor(d() * free.length)] as (typeof pairs)[number];
  chat.cooldown.set(`pair|${pair.a.slot}|${pair.b.slot}`, c.minute + 90);
  const pool = pairPool(pair.kind, pair.a.handle, pair.b.handle);
  if (pool.length === 0) return;
  const total = pool.reduce((a, x) => a + x.weight, 0);
  let r = d() * total;
  let ex = pool[pool.length - 1]!;
  for (const x of pool) {
    r -= x.weight;
    if (r < 0) {
      ex = x;
      break;
    }
  }
  if (!canSpeak(c, pair.a.slot) || chat.tokens.world < 1) return;
  const src = `state:exchange:${pair.a.slot}:${pair.b.slot}:${c.minute}`;
  const lines: Queued[] = [];
  for (let i = 0; i < ex.lines.length; i++) {
    const line = ex.lines[i]!;
    const first = ex.between && ex.between[0] !== pair.a.handle ? pair.b : pair.a;
    const second = first === pair.a ? pair.b : pair.a;
    const who = line.role === 'a' ? first : second;
    const other = line.role === 'a' ? second : first;
    const filled = fill(line.text, { handle: other.handle, player: c.player });
    if (filled === null) return;
    const v = applyVoice(voiceOf(who.voice), filled, 'banter', d);
    lines.push({
      due: c.minute + i * 2,
      slot: who.slot,
      channel: 'world',
      text: v.text,
      template: ex.id,
      source: src,
      reply: i > 0,
      slots: { handle: other.handle },
    });
  }
  chat.tokens.world -= 1;
  source(c, src, `tie:${pair.kind}:${pair.a.slot}:${pair.b.slot}`);
  for (const l of lines) enqueue(c, l);
}

/** Small scenes (POW-M5-27): plan what can happen now, queue the lines and start the effects. */
function scenes(c: Ctx, events: readonly SimEvent[]): void {
  const { state, chat } = c;
  const crowd = state.crowd!;
  const clock = state.clock!;
  const hourKey = Math.floor(localMinute(clock.nowMs, clock.tzOffsetMin) / 60);
  const key = (k: string): string => `${k}|${hourKey}`;
  const d = diceFor(state, chat, 7000 + c.minute);
  const count = (k: string): void => {
    chat.scenes.counts.set(key(k), (chat.scenes.counts.get(key(k)) ?? 0) + 1);
  };
  const gap = (): number =>
    SCENE_BALANCE.lineGapMin[0] +
    Math.floor(d() * (SCENE_BALANCE.lineGapMin[1] - SCENE_BALANCE.lineGapMin[0] + 1));
  // Counts of hours gone by are of no use.
  for (const k of chat.scenes.counts.keys())
    if (Number(k.split('|')[1]) < hourKey) chat.scenes.counts.delete(k);

  const plans = planScenes({
    state,
    crowd,
    minute: c.minute,
    phase: c.phase,
    used: (k) => chat.scenes.counts.get(key(k)) ?? 0,
    canSpeak: (slot) => canSpeak(c, slot),
    cooled: (k, slot) => (chat.cooldown.get(`scene|${k}|${slot}`) ?? -1) <= c.minute,
    // A scene already in line counts as said: two of the same must not be planned before the first is heard.
    recent: [...chat.recent.local, ...chat.queue.map((q) => q.template)],
    dice: d,
  });
  for (const plan of plans) {
    count(plan.kind);
    for (const l of plan.lines)
      chat.cooldown.set(`scene|${plan.kind}|${l.slot}`, c.minute + SCENE_BALANCE.cooldownMin);
    for (const f of plan.fx) startScene(state, crowd, f.slot, f.kind, f.ticks);
    const src = source(c, `state:scene:${plan.scene.id}:${c.minute}`, `scene:${plan.kind}`);
    let due = c.minute + 1;
    plan.lines.forEach((l, i) => {
      const who = c.ids[l.slot]!;
      const other = plan.lines.find((x) => x.slot !== l.slot);
      const filled = fill(plan.scene.lines[i]!.text, {
        handle: other ? c.ids[other.slot]!.handle : undefined,
      });
      if (filled === null) return;
      const v = applyVoice(voiceOf(who.voice), filled, 'banter', d);
      enqueue(c, {
        due,
        slot: l.slot,
        channel: 'local',
        text: v.text,
        template: plan.scene.id,
        source: src,
        reply: i > 0,
        slots: {},
      });
      due += gap();
    });
    if (plan.wisher !== undefined) chat.scenes.wished.set(plan.wisher, c.minute);
  }

  // A wish comes true when a real event of theirs follows, rarely.
  for (const e of events) {
    if (e.type !== 'travelerRankUp' && e.type !== 'travelerLooted') continue;
    const at = chat.scenes.wished.get(e.slot);
    if (at === undefined) continue;
    const age = c.minute - at;
    if (age > SCENE_BALANCE.cameWithinMin) chat.scenes.wished.delete(e.slot);
    if (age < SCENE_BALANCE.cameAfterMin || age > SCENE_BALANCE.cameWithinMin) continue;
    chat.scenes.wished.delete(e.slot);
    if (
      (chat.scenes.counts.get(key('wishCame')) ?? 0) >= SCENE_BALANCE.capPerHour ||
      d() >= SCENE_BALANCE.chance.wishCame ||
      !canSpeak(c, e.slot)
    )
      continue;
    const scene = cameTrue(
      e.type === 'travelerRankUp' ? 'rank' : 'drop',
      d,
      chat.recent[crowd.promoted[e.slot] ? 'local' : 'world'],
    );
    if (!scene) continue;
    count('wishCame');
    const who = c.ids[e.slot]!;
    const v = applyVoice(voiceOf(who.voice), scene.lines[0]!.text, 'banter', d);
    enqueue(c, {
      due: c.minute + 1,
      slot: e.slot,
      channel: crowd.promoted[e.slot] ? 'local' : 'world',
      text: v.text,
      template: scene.id,
      source: source(c, `state:scene:${scene.id}:${c.minute}`, `scene:wishCame:${e.slot}`),
      reply: false,
      slots: {},
    });
  }
}

/** Lines whose time has come, from replies, answers, fixes and exchanges. */
function flush(c: Ctx): void {
  const q = c.chat.queue;
  let sent = 0;
  for (let i = 0; i < q.length && sent < CHAT.burst + 2;) {
    const item = q[i]!;
    if (item.due > c.minute) {
      i++;
      continue;
    }
    q.splice(i, 1);
    if (!c.state.crowd!.online[item.slot]) continue;
    // A line that is not a reply waits its speaker's gap: if they spoke meanwhile, it is dropped.
    if (!item.reply && !canSpeak(c, item.slot)) continue;
    if (item.channel === 'local' && !c.state.crowd!.promoted[item.slot]) continue;
    speak(
      c,
      item.slot,
      item.channel,
      item.text,
      item.template,
      item.source,
      item.reply,
      item.slots,
      item.chips,
    );
    sent++;
  }
}

/** The share of the budget at a local hour. */
export const hourShare = (hour: number): number => CHAT.hour[Math.floor(hour) % 24] as number;

/** What the social code needs of the engine, passed in so the two files do not import each other. */
export interface Helpers {
  enqueue(c: Ctx, q: Queued): void;
  canSpeak(c: Ctx, slot: number, reply?: boolean): boolean;
  source(c: Ctx, id: string, fact: string): string;
  voice(c: Ctx, slot: number, text: string, d: () => number): string;
  dice(c: Ctx, salt: number): () => number;
}

const HELPERS: Helpers = {
  enqueue,
  canSpeak,
  source,
  voice: (c, slot, text, d) => applyVoice(voiceOf(c.ids[slot]!.voice), text, 'banter', d).text,
  dice: (c, salt) => diceFor(c.state, c.chat, salt),
};

/** Puts a player command (a chip or a friend action) in line for the chat step. */
export function queueChatCommand(state: SimState, item: Inbox): void {
  const chat = (state.chat ??= newChatState());
  if (chat.inbox.length < 8) chat.inbox.push(item);
}

function contextOf(state: SimState, chat: ChatState, minute: number): Ctx {
  const crowd = state.crowd!;
  const clock = state.clock!;
  const local = localMinute(clock.nowMs, clock.tzOffsetMin);
  const hour = (local - dayIndexOf(local) * MIN_PER_DAY) / 60;
  const who = findAvatar(state);
  return {
    state,
    chat,
    ids: identitiesOf(crowd.seed),
    minute,
    hour,
    tod: hourShare(hour),
    weather: weatherOn(state, state.worldTick),
    phase: dayPhase(state.worldTick),
    player: (who === null ? undefined : state.entities.comps.avatar[who]?.handle) ?? 'friend',
    real: local,
    day: dayIndexOf(local),
  };
}

/**
 * Test hook (POW-M6-20): the ids of the templates a Traveler could say for a trigger right now,
 * before any dice are rolled. Read only: it changes no chat or sim state. Staged tests use it to
 * prove a line is reachable without depending on which roll picks it.
 */
export function templatesFor(state: SimState, slot: number, trigger: Trigger): string[] {
  const crowd = state.crowd;
  if (!crowd || !state.clock) return [];
  const c = contextOf(state, state.chat ?? newChatState(), crowd.lastMinute);
  const t = c.ids[slot];
  if (!t) return [];
  return (BY_TRIGGER.get(trigger) ?? []).filter((tpl) => eligible(c, t, tpl)).map((tpl) => tpl.id);
}

/**
 * The chat system. Runs after the crowd, once per abstract minute. It reads the events of this tick
 * and the state, and sends `travelerSpoke` events. It does nothing without a crowd. The player's
 * commands (chips, friend actions) are handled on the tick they arrive.
 */
export function chatSystem(state: SimState): void {
  const crowd = state.crowd;
  const clock = state.clock;
  if (!crowd || !clock || !crowd.caughtUp) return;
  const chat = (state.chat ??= newChatState());
  if (chat.inbox.length > 0) processInbox(contextOf(state, chat, crowd.lastMinute), HELPERS);
  if (crowd.lastMinute === chat.lastMinute) return;
  chat.lastMinute = crowd.lastMinute;
  const ctx = contextOf(state, chat, crowd.lastMinute);
  const speakers = onlineCount(crowd);
  chat.tokens.world = Math.min(
    CHAT.tokenCap,
    chat.tokens.world + speakers * CHAT.tokensPerSpeaker.world * ctx.tod,
  );
  chat.tokens.local = Math.min(
    CHAT.tokenCap,
    chat.tokens.local + crowd.ents.size * CHAT.tokensPerSpeaker.local * ctx.tod,
  );
  const events = [...state.events.list];
  touchNear(ctx);
  events.forEach((e, i) => fromEvent(ctx, e, i));
  flush(ctx);
  exchanges(ctx);
  scenes(ctx, events);
  loginHellos(ctx, HELPERS, events);
  mailOnLogin(ctx, events, (salt) => diceFor(state, chat, salt + ctx.minute));
  friendAsks(ctx, HELPERS);
  duelAsks(ctx, HELPERS);
  guildInvites(ctx, HELPERS);
  guildChatter(ctx, HELPERS, events);
  memoryLines(ctx, HELPERS);
  chatter(ctx);
  chat.lastWeather = ctx.weather;
  chat.lastPhase = ctx.phase;
  void crowdOf;
}

/**
 * World events (POW-M5-11) in chat: someone online says a raid, an invasion or a market day has
 * begun, and how a raid ended. Runs every tick from the social step, since events start on the real
 * minute and not the chat's.
 */
function worldLines(c: Ctx, events: readonly SimEvent[]): void {
  const { state, chat } = c;
  for (const [i, e] of events.entries()) {
    let trigger: Trigger | null = null;
    let site = '';
    if (e.type === 'worldEventStarted') {
      trigger =
        e.kind === 'raid'
          ? 'world.raid'
          : e.kind === 'invasion'
            ? 'world.invasion'
            : e.kind === 'market'
              ? 'world.market'
              : null;
      site = e.site;
    } else if (e.type === 'raidEnded') {
      trigger = e.won ? 'world.raidWon' : 'world.raidLost';
      site = e.site;
    }
    if (!trigger) continue;
    const pool = c.ids.filter(
      (x) => state.crowd!.online[x.slot] === 1 && canSpeak(c, x.slot, true),
    );
    for (let k = 0; k < 2 && pool.length > 0; k++) {
      const who = pool.splice(
        Math.floor(hash01(state.seed, 0x3e1, state.tick, i * 3 + k) * pool.length),
        1,
      )[0]!;
      const place = PLACE_NAMES[site] ?? '';
      const made = make(c, who, trigger, place ? { place } : {});
      if (!made) continue;
      const src = source(c, `ev:${state.tick}:${i}:${k}`, `world:${e.type}`);
      speak(c, who.slot, made.tpl.channel, made.text, made.tpl.id, src, false, made.slots);
      void chat;
    }
  }
}

/**
 * Memory of what the player did (POW-M5-06). Runs every tick, after the systems that send the
 * events it reads (a kill, passing a Traveler on a board), because the engine's own step only
 * sees the events of the tick an abstract minute turns.
 */
export function socialSystem(state: SimState): void {
  const crowd = state.crowd;
  if (!crowd || !state.clock || !crowd.caughtUp || !state.events.list.some(memorable)) return;
  const chat = (state.chat ??= newChatState());
  const ctx = contextOf(state, chat, crowd.lastMinute);
  recordMemories(ctx, state.events.list);
  duelEvents(ctx, HELPERS, state.events.list);
  rivalOnEntry(ctx, HELPERS, state.events.list);
  partyEvents(ctx, HELPERS, state.events.list);
  pitEvents(ctx, HELPERS, state.events.list);
  worldLines(ctx, state.events.list);
  // Joining and goals happen on a command's tick, not a minute's: the guild hears them here.
  const guildNews = state.events.list.filter(
    (e) => e.type === 'guildJoined' || e.type === 'guildGoalDone',
  );
  if (guildNews.length > 0) guildChatter(ctx, HELPERS, guildNews, false);
}
