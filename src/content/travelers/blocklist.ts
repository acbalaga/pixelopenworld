/**
 * Handle blocklist (design/12 section 2). Slurs, insults, sexual terms, real brands and real
 * public figures, matched as substrings of the normalized handle. This is data: the test holds it
 * to a list of known-bad inputs, including leetspeak and separator variants.
 *
 * It is deliberately a short, blunt list. A harmless handle that trips it is rerolled, and a
 * player-chosen handle is checked again by the shared handle rules.
 */

/** Look-alikes folded to the letter they stand for. */
const FOLD: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'l',
};

/**
 * Lowercase, look-alikes folded to letters, every separator and anything that is not a letter
 * removed, and runs of the same letter collapsed to one so "fuuuck" and "f_u_c_k" match.
 */
export function normalizeForBlock(handle: string): string {
  let out = '';
  for (const ch of handle.toLowerCase()) {
    const c = FOLD[ch] ?? ch;
    if (c < 'a' || c > 'z') continue;
    if (out.endsWith(c)) continue;
    out += c;
  }
  return out;
}

/** Terms are stored in their collapsed form (no doubled letters), so they match the normalized text. */
const collapse = (s: string): string => normalizeForBlock(s);

const TERMS: readonly string[] = [
  // Profanity and insults.
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'bastard',
  'asshole',
  'dickhead',
  'twat',
  'wanker',
  'prick',
  'douche',
  'moron',
  'idiot',
  'retard',
  'loser',
  'slut',
  'whore',
  // Slurs (the shortest forms that catch the variants).
  'nigger',
  'nigga',
  'faggot',
  'dyke',
  'tranny',
  'chink',
  'spics',
  'kike',
  'coons',
  'gook',
  'wetback',
  // Sexual and violent terms.
  'porn',
  'penis',
  'vagina',
  'boob',
  'nude',
  'raped',
  'rapist',
  'molest',
  'nazi',
  'hitler',
  'genocide',
  'suicide',
  'killyourself',
  // Staff and system look-alikes.
  'admin',
  'moderator',
  'staff',
  'system',
  'official',
  'support',
  // Real brands and platforms.
  'google',
  'apple',
  'amazon',
  'microsoft',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'twitter',
  'discord',
  'twitch',
  'steam',
  'nintendo',
  'playstation',
  'xbox',
  'nike',
  'adidas',
  'cocacola',
  'pepsi',
  'mcdonald',
  'starbucks',
  'disney',
  'pokemon',
  'minecraft',
  'fortnite',
  'roblox',
  'netflix',
  'tesla',
  // Real public figures, as a short sample.
  'trump',
  'obama',
  'biden',
  'putin',
  'elonmusk',
  'beyonce',
  'kardashian',
];

export const BLOCKLIST: readonly string[] = [...new Set(TERMS.map(collapse))];

/** True if the handle contains any blocked term after normalization. */
export function isBlocked(handle: string): boolean {
  const n = normalizeForBlock(handle);
  return BLOCKLIST.some((t) => n.includes(t));
}
