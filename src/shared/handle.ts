/**
 * Handle rules. A handle is the name other players see, so the same check runs on the client at
 * setup and on the Worker when it matters (M5). Pure.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 16;

/** Why a handle is not allowed, or `ok`. Keys into `UI_STRINGS.setup.handleErrors`. */
export type HandleProblem = 'ok' | 'short' | 'long' | 'chars' | 'edges' | 'blocked';

/**
 * A short blocklist, matched against the handle with letters only and common look-alikes folded.
 * It catches the plain cases. It is not a profanity filter and is not meant to be one.
 */
const BLOCKED = [
  'admin',
  'moderator',
  'staff',
  'system',
  'fuck',
  'shit',
  'cunt',
  'nigger',
  'nigga',
  'rape',
];

const FOLD: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/** Lowercase, look-alike digits folded to letters, everything but letters removed. */
function fold(s: string): string {
  return [...s.toLowerCase()]
    .map((c) => FOLD[c] ?? c)
    .filter((c) => c >= 'a' && c <= 'z')
    .join('');
}

/** Checks a handle. Letters, digits, underscore and hyphen; no leading or trailing separator. */
export function checkHandle(raw: string): HandleProblem {
  const h = raw.trim();
  if (h.length < HANDLE_MIN) return 'short';
  if (h.length > HANDLE_MAX) return 'long';
  if (!/^[A-Za-z0-9_-]+$/.test(h)) return 'chars';
  if (/^[_-]|[_-]$|[_-]{2}/.test(h)) return 'edges';
  const f = fold(h);
  if (BLOCKED.some((b) => f.includes(b))) return 'blocked';
  return 'ok';
}
