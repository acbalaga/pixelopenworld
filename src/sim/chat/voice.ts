import type { Category, VoiceDef } from '../../content/chat/types';

/**
 * Voice transforms (design/12 4.3), applied after a template is filled, in this order: lexicon,
 * case, punctuation, emoticon, typo, sign-off. Pure: the dice are an argument, a function that
 * returns a number in [0, 1).
 */

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lexicon(text: string, lex: VoiceDef['lexicon']): string {
  let out = text;
  for (const [from, to] of Object.entries(lex))
    out = out.replace(new RegExp(`\\b${escape(from)}\\b`, 'gi'), to);
  return out.replace(/\s{2,}/g, ' ').trim();
}

function recase(text: string, mode: VoiceDef['case'], dice: () => number): string {
  switch (mode) {
    case 'lower':
      return text.toLowerCase();
    case 'sentence':
      return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
    case 'title':
      return text.replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b);
    case 'shout': {
      const words = text.split(' ');
      const long = words.map((w, i) => [w, i] as const).filter(([w]) => w.length > 3);
      if (long.length === 0) return text;
      const [, at] = long[Math.floor(dice() * long.length)] as readonly [string, number];
      words[at] = (words[at] as string).toUpperCase();
      return words.join(' ');
    }
  }
}

function punctuate(text: string, mode: VoiceDef['punct']): string {
  const bare = text.replace(/[.!?…]+$/, '');
  switch (mode) {
    case 'none':
    case 'light':
      return bare;
    case 'full':
      return `${bare}.`;
    case 'ellipsis':
      return `${bare}...`;
    case 'exclaim':
      return `${bare}!`;
  }
}

function typo(
  text: string,
  v: VoiceDef['typo'],
  dice: () => number,
): { text: string; fix?: string } {
  if (v.kinds.length === 0 || dice() >= v.rate) return { text };
  const words = text.split(' ');
  const idx = words.map((w, i) => [w, i] as const).filter(([w]) => /^[A-Za-z]{4,}$/.test(w));
  if (idx.length === 0) return { text };
  const [word, at] = idx[Math.floor(dice() * idx.length)] as readonly [string, number];
  const kind = v.kinds[Math.floor(dice() * v.kinds.length)] as 'swap' | 'double' | 'drop';
  const k = 1 + Math.floor(dice() * (word.length - 2));
  const bad =
    kind === 'swap'
      ? word.slice(0, k) + word[k + 1] + word[k] + word.slice(k + 2)
      : kind === 'double'
        ? word.slice(0, k) + word[k] + word.slice(k)
        : word.slice(0, k) + word.slice(k + 1);
  if (bad === word) return { text };
  words[at] = bad;
  const out: { text: string; fix?: string } = { text: words.join(' ') };
  if (dice() < v.fix) out.fix = `*${word}`;
  return out;
}

export interface Voiced {
  text: string;
  /** A correction said as a second line (`*word`), when the voice makes one. */
  fix?: string;
}

/** A filled line through a voice. */
export function applyVoice(
  voice: VoiceDef,
  text: string,
  category: Category,
  dice: () => number,
): Voiced {
  let out = lexicon(text, voice.lexicon);
  out = recase(out, voice.case, dice);
  out = punctuate(out, voice.punct);
  const e = voice.emoticon;
  if (dice() < e.rate) {
    const pool = [...e.texts, ...e.glyphs.map((g) => `:${g}:`)];
    if (pool.length > 0) out = `${out} ${pool[Math.floor(dice() * pool.length)] as string}`;
  }
  const t = typo(out, voice.typo, dice);
  out = t.text;
  if (category === 'farewell' && voice.signoff !== '' && dice() < 0.5)
    out = `${out} ${voice.signoff}`;
  return t.fix === undefined ? { text: out } : { text: out, fix: t.fix };
}

/** The glyph ids named in a line, in order. */
export const glyphsIn = (text: string): string[] =>
  [...text.matchAll(/:([a-z]+):/g)].map((m) => m[1] as string);
