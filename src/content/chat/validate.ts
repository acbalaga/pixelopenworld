import { HAND_TUNED } from '../travelers/handTuned';
import { ACTIVITIES, ARCHETYPES, TIE_KINDS, VOICE_IDS } from '../travelers/types';
import { isBlocked } from '../travelers/blocklist';
import { PLACES } from '../people/places';
import { DUNGEONS } from '../world/dungeons';
import { GLYPHS } from './glyphs';
import { DUNGEON_NAMES, PLACE_NAMES, UNBAKED_NAMES } from './names';
import { SLOTS_BY_TRIGGER } from './slots';
import { RUMORS } from './rumors';
import { EXCHANGES, TEMPLATES } from './templates';
import {
  CATEGORIES,
  SLOT_NAMES,
  TRIGGERS,
  type ChatExchange,
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
  }
  const wrong = c.rumors.filter((r) => !r.true).length;
  if (c.rumors.length > 0 && (wrong / c.rumors.length > 0.4 || wrong === 0))
    errors.push(`rumors: ${wrong} of ${c.rumors.length} wrong, expected about one in four`);

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
  });
