import { HAND_TUNED } from '../travelers/handTuned';
import { ACTIVITIES, ARCHETYPES, TIE_KINDS, VOICE_IDS } from '../travelers/types';
import { isBlocked } from '../travelers/blocklist';
import { PLACES } from '../people/places';
import { DUNGEONS } from '../world/dungeons';
import { GLYPHS } from './glyphs';
import { DUNGEON_NAMES, PLACE_NAMES, UNBAKED_NAMES } from './names';
import { SLOTS_BY_TRIGGER } from './slots';
import { RUMORS } from './rumors';
import {
  LETTERS,
  LETTER_KINDS,
  LETTER_SLOTS,
  type LetterKind,
  type LetterTemplate,
} from './letters';
import { SCENES } from './scenes';
import { DUEL_LINES, RIVAL_LINES, WAKE } from './social';
import { PARTY_LINES } from './party';
import { DUELIST_LINES, PIT_LINES } from './pit';
import { EXCHANGES, TEMPLATES } from './templates';
import {
  CATEGORIES,
  SLOT_NAMES,
  TRIGGERS,
  type ChatExchange,
  type ChatScene,
  type ChatTemplate,
  type Glyph,
  type Rumor,
  type VoiceDef,
} from './types';
import { VOICES } from './voices';

/**
 * The chat validator (POW-M5-05, design/12 4.2 and 4.8). Run at bake and in the tests. A template
 * fails if a slot cannot be filled from its trigger, if its text names anything not baked (D25),
 * contains an emoji code point, a real date, a blocked word or an em dash, or uses a glyph, voice,
 * archetype or phase that does not exist. Pure: it takes the content as arguments.
 */
export interface ChatContent {
  templates: readonly ChatTemplate[];
  exchanges: readonly ChatExchange[];
  voices: readonly VoiceDef[];
  glyphs: readonly Glyph[];
  rumors: readonly Rumor[];
  scenes?: readonly ChatScene[];
  /** Wake lines (M5-31): at least twelve in all, none with a slot. */
  wake?: readonly string[];
  /** Letter templates (M5-12): about 150, each kind using only its own slots. */
  letters?: readonly LetterTemplate[];
  /** Other social lines (M5-12 duel and Rival lines): text checks, and only `{player}` and `{dungeon}`. */
  other?: readonly string[];
  /** Pit chat lines (M5-30). */
  pit?: readonly string[];
  /** Party chat lines (M5-07). */
  party?: readonly string[];
}

const EMOJI = /\p{Extended_Pictographic}/u;
const DATE =
  /\b(?:19|20)\d{2}\b|\b(?:january|february|march|april|june|july|august|september|october|november|december)\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b\d{1,2}\/\d{1,2}\b/i;
const PHASES = ['dawn', 'day', 'dusk', 'night'];
const DASH = /[–—]/;

function checkText(where: string, text: string, errors: string[], glyphIds: Set<string>): void {
  if (text.trim() === '') errors.push(`${where}: empty text`);
  if (EMOJI.test(text)) errors.push(`${where}: emoji code point`);
  if (DASH.test(text)) errors.push(`${where}: dash`);
  const bare = text.replace(/\{[a-z]+\}/g, ' ').replace(/:[a-z]+:/g, ' ');
  if (DATE.test(bare)) errors.push(`${where}: a real date`);
  for (const word of bare.split(/[^A-Za-z0-9'<>^;_-]+/))
    if (word.length > 2 && isBlocked(word)) errors.push(`${where}: blocked word "${word}"`);
  for (const name of UNBAKED_NAMES)
    if (new RegExp(`\\b${name}\\b`, 'i').test(bare))
      errors.push(`${where}: names unbaked "${name}"`);
  for (const m of text.matchAll(/:([a-z]+):/g))
    if (!glyphIds.has(m[1] as string)) errors.push(`${where}: unknown glyph :${m[1]}:`);
}

const SCENE_ROLES: Record<ChatScene['kind'], RegExp> = {
  wish: /^a{1,2}$/,
  wishCame: /^a$/,
  dance: /^abc$/,
  ghost: /^(?:ab){1,2}a?$/,
  dummy: /^(?:aa|aba)$/,
};

function validateScenes(
  scenes: readonly ChatScene[],
  errors: string[],
  glyphIds: Set<string>,
  seen: Set<string>,
): void {
  const per = new Map<string, number>();
  for (const sc of scenes) {
    const w = `scene ${sc.id}`;
    if (seen.has(sc.id)) errors.push(`${w}: duplicate id`);
    seen.add(sc.id);
    const roles = sc.lines.map((l) => l.role).join('');
    if (!SCENE_ROLES[sc.kind].test(roles)) errors.push(`${w}: ${sc.kind} roles "${roles}"`);
    if (sc.kind === 'ghost' && (sc.lines.length < 3 || sc.lines.length > 5))
      errors.push(`${w}: ${sc.lines.length} lines`);
    if ((sc.kind === 'wishCame') !== (sc.on !== undefined)) errors.push(`${w}: on`);
    const key = sc.kind === 'wishCame' ? `wishCame.${sc.on}` : sc.kind;
    per.set(key, (per.get(key) ?? 0) + 1);
    sc.lines.forEach((l, i) => {
      checkText(`${w}[${i}]`, l.text, errors, glyphIds);
      for (const m of l.text.matchAll(/\{([a-z]+)\}/g))
        if (m[1] !== 'handle') errors.push(`${w}[${i}]: {${m[1]}}`);
    });
  }
  if (scenes.length === 0) return;
  for (const [k, min] of [
    ['wish', 6],
    ['dance', 6],
    ['ghost', 6],
    ['dummy', 6],
    ['wishCame.rank', 3],
    ['wishCame.drop', 3],
  ] as const)
    if ((per.get(k) ?? 0) < min) errors.push(`scenes ${k}: ${per.get(k) ?? 0}, expected ${min}`);
}

const LETTER_REQUIRED: Partial<Record<LetterKind, readonly string[]>> = {
  giftCoin: ['coin'],
  giftItem: ['item', 'qty'],
  invite: ['place'],
};

function validateLetters(
  letters: readonly LetterTemplate[],
  errors: string[],
  glyphIds: Set<string>,
): void {
  if (letters.length === 0) return;
  if (letters.length < 140) errors.push(`letters: ${letters.length}, expected about 150`);
  const seen = new Set<string>();
  for (const l of letters) {
    const w = `letter ${l.id}`;
    if (seen.has(l.id)) errors.push(`${w}: duplicate id`);
    seen.add(l.id);
    if (!(LETTER_KINDS as readonly string[]).includes(l.kind)) errors.push(`${w}: kind ${l.kind}`);
    checkText(w, l.text, errors, glyphIds);
    const allowed = LETTER_SLOTS[l.kind] ?? [];
    const used = [...l.text.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1] as string);
    for (const u of used)
      if (!allowed.includes(u)) errors.push(`${w}: {${u}} not allowed in ${l.kind}`);
    for (const need of LETTER_REQUIRED[l.kind] ?? [])
      if (!used.includes(need)) errors.push(`${w}: ${l.kind} must use {${need}}`);
    if (/\{[^a-z}]|[^{a-z]\}/.test(l.text.replace(/\{[a-z]+\}/g, '')))
      errors.push(`${w}: stray brace`);
  }
  for (const k of LETTER_KINDS)
    if (!letters.some((l) => l.kind === k)) errors.push(`letters: no ${k}`);
}

export function validateChat(c: ChatContent): string[] {
  const errors: string[] = [];
  const glyphIds = new Set(c.glyphs.map((g) => g.id));
  const seen = new Set<string>();
  const slots = new Set<string>(SLOT_NAMES);

  for (const g of c.glyphs) {
    if (g.rows.length !== 8 || g.rows.some((r) => r.length !== 8 || /[^.#o]/.test(r)))
      errors.push(`glyph ${g.id}: must be 8 rows of 8 from . # o`);
    if (!g.rows.some((r) => r.includes('#'))) errors.push(`glyph ${g.id}: no ink`);
  }
  if (c.glyphs.length !== 12) errors.push(`glyphs: ${c.glyphs.length}, expected 12`);

  const voiceIds = new Set(c.voices.map((v) => v.id));
  for (const id of VOICE_IDS) if (!voiceIds.has(id)) errors.push(`voice ${id}: missing`);
  for (const v of c.voices) {
    for (const g of v.emoticon.glyphs)
      if (!glyphIds.has(g)) errors.push(`voice ${v.id}: glyph ${g}`);
    for (const t of v.emoticon.texts) if (EMOJI.test(t)) errors.push(`voice ${v.id}: emoji`);
    if (EMOJI.test(v.signoff)) errors.push(`voice ${v.id}: emoji in signoff`);
  }

  for (const t of c.templates) {
    const w = `template ${t.id}`;
    if (seen.has(t.id)) errors.push(`${w}: duplicate id`);
    seen.add(t.id);
    if (!(CATEGORIES as readonly string[]).includes(t.category)) errors.push(`${w}: category`);
    if (!(TRIGGERS as readonly string[]).includes(t.trigger)) errors.push(`${w}: trigger`);
    if (t.channel !== 'world' && t.channel !== 'local') errors.push(`${w}: channel ${t.channel}`);
    if (t.text.length === 0) errors.push(`${w}: no text`);
    if (!(t.weight > 0)) errors.push(`${w}: weight`);
    if (!(t.cooldownMin >= 0)) errors.push(`${w}: cooldown`);
    const allowed = new Set<string>(SLOTS_BY_TRIGGER[t.trigger] ?? []);
    t.text.forEach((text, i) => {
      checkText(`${w}[${i}]`, text, errors, glyphIds);
      for (const m of text.matchAll(/\{([a-z]+)\}/g)) {
        const name = m[1] as string;
        if (!slots.has(name)) errors.push(`${w}[${i}]: unknown slot {${name}}`);
        else if (!allowed.has(name))
          errors.push(`${w}[${i}]: {${name}} cannot be filled from ${t.trigger}`);
      }
      if (/\{[^a-z}]|[^{a-z]\}/.test(text.replace(/\{[a-z]+\}/g, '')))
        errors.push(`${w}[${i}]: stray brace`);
    });
    for (const a of t.when?.archetype ?? [])
      if (!(ARCHETYPES as readonly string[]).includes(a)) errors.push(`${w}: archetype ${a}`);
    for (const v of t.when?.voice ?? [])
      if (!(VOICE_IDS as readonly string[]).includes(v)) errors.push(`${w}: voice ${v}`);
    for (const p of t.when?.phase ?? []) if (!PHASES.includes(p)) errors.push(`${w}: phase ${p}`);
    for (const h of t.when?.handle ?? [])
      if (!HAND_TUNED.some((x) => x.handle === h)) errors.push(`${w}: handle ${h}`);
    for (const a of t.when?.doing ?? [])
      if (!(ACTIVITIES as readonly string[]).includes(a)) errors.push(`${w}: doing ${a}`);
    for (const pl of t.when?.place ?? []) if (!PLACES[pl]) errors.push(`${w}: place ${pl}`);
  }
  // Banter is carried by the exchanges, so it needs no single-line template.
  for (const cat of CATEGORIES)
    if (cat === 'banter' ? c.exchanges.length === 0 : !c.templates.some((t) => t.category === cat))
      errors.push(`category ${cat}: no template`);

  for (const x of c.exchanges) {
    const w = `exchange ${x.id}`;
    if (seen.has(x.id)) errors.push(`${w}: duplicate id`);
    seen.add(x.id);
    if (!(TIE_KINDS as readonly string[]).includes(x.tie)) errors.push(`${w}: tie ${x.tie}`);
    if (x.lines.length < 2 || x.lines.length > 5) errors.push(`${w}: ${x.lines.length} lines`);
    if (x.between) {
      const [h1, h2] = x.between;
      const a = HAND_TUNED.find((y) => y.handle === h1);
      const b = HAND_TUNED.find((y) => y.handle === h2);
      if (!a || !b) errors.push(`${w}: between names an unknown handle`);
      else if (!a.ties.some((tie) => tie.slot === b.slot && tie.kind === x.tie))
        if (!b.ties.some((tie) => tie.slot === a.slot && tie.kind === x.tie))
          errors.push(`${w}: ${h1} and ${h2} have no ${x.tie} tie`);
    }
    x.lines.forEach((l, i) => {
      if (l.role !== (i % 2 === 0 ? 'a' : 'b')) errors.push(`${w}[${i}]: role order`);
      checkText(`${w}[${i}]`, l.text, errors, glyphIds);
      for (const m of l.text.matchAll(/\{([a-z]+)\}/g))
        if (m[1] !== 'handle' && m[1] !== 'player') errors.push(`${w}[${i}]: {${m[1]}}`);
    });
  }

  for (const r of c.rumors) {
    const w = `rumor ${r.id}`;
    if (seen.has(r.id)) errors.push(`${w}: duplicate id`);
    seen.add(r.id);
    checkText(w, r.text, errors, glyphIds);
    if (/\{/.test(r.text)) errors.push(`${w}: slots in a rumor`);
    if (r.gate) {
      if (!/^flag\.[a-z0-9_]+$/.test(r.gate.sets)) errors.push(`${w}: gate sets ${r.gate.sets}`);
      for (const f of r.gate.needs)
        if (!/^flag\.[a-z0-9_]+$/.test(f)) errors.push(`${w}: gate needs ${f}`);
    }
  }
  const wrong = c.rumors.filter((r) => !r.true).length;
  if (c.rumors.length > 0 && (wrong / c.rumors.length > 0.4 || wrong === 0))
    errors.push(`rumors: ${wrong} of ${c.rumors.length} wrong, expected about one in four`);

  if (c.wake) {
    if (c.wake.length < 12) errors.push(`wake lines: ${c.wake.length}, expected 12`);
    c.wake.forEach((t, i) => {
      checkText(`wake[${i}]`, t, errors, glyphIds);
      if (/\{/.test(t)) errors.push(`wake[${i}]: slot`);
    });
  }
  (c.other ?? []).forEach((t, i) => {
    checkText(`other[${i}]`, t, errors, glyphIds);
    for (const m of t.matchAll(/\{([a-z]+)\}/g))
      if (m[1] !== 'player' && m[1] !== 'dungeon') errors.push(`other[${i}]: {${m[1]}}`);
  });
  // Pit chat (M5-30): a duelist's name and the player's honor.
  (c.pit ?? []).forEach((t, i) => {
    checkText(`pit[${i}]`, t, errors, glyphIds);
    for (const m of t.matchAll(/\{([a-z]+)\}/g))
      if (!['handle', 'honor'].includes(m[1]!)) errors.push(`pit[${i}]: {${m[1]}}`);
  });
  // Party chat (M5-07): its own slots, the run, a drop, a roll and the player.
  (c.party ?? []).forEach((t, i) => {
    checkText(`party[${i}]`, t, errors, glyphIds);
    for (const m of t.matchAll(/\{([a-z]+)\}/g))
      if (!['player', 'activity', 'item', 'roll'].includes(m[1]!))
        errors.push(`party[${i}]: {${m[1]}}`);
  });
  validateLetters(c.letters ?? [], errors, glyphIds);
  validateScenes(c.scenes ?? [], errors, glyphIds, new Set(c.exchanges.map((x) => x.id)));
  for (const id of Object.keys(PLACE_NAMES))
    if (!PLACES[id]) errors.push(`place name ${id}: no such place`);
  for (const id of Object.keys(DUNGEON_NAMES))
    if (!DUNGEONS[id]) errors.push(`dungeon name ${id}: no such dungeon`);
  return errors;
}

/** The shipped content, validated. */
export const validateShippedChat = (): string[] =>
  validateChat({
    templates: TEMPLATES,
    exchanges: EXCHANGES,
    voices: VOICES,
    glyphs: GLYPHS,
    rumors: RUMORS,
    scenes: SCENES,
    wake: [...WAKE.grumpy, ...WAKE.friendly].map((r) => r.text),
    letters: LETTERS,
    other: [...Object.values(DUEL_LINES), ...Object.values(RIVAL_LINES)].flatMap((l) =>
      l.map((r) => r.text),
    ),
    party: Object.values(PARTY_LINES).flatMap((l) => l.map((r) => r.text)),
    pit: [
      ...Object.values(PIT_LINES).flatMap((l) => l.map((r) => r.text)),
      ...Object.values(DUELIST_LINES).flatMap((d) => [d.win, d.lose]),
    ],
  });
