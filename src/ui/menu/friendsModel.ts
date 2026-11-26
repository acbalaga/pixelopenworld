import { PLACE_NAMES } from '../../content/chat/names';
import { FRIEND_STRINGS as F } from '../../content/strings/friends';
import { ACTIVITIES, FLAG, MEMORY_KINDS } from '../../content/travelers/types';
import { daysAgoText, subjectName } from '../../sim/chat/social';
import type { SimState } from '../../sim/state';
import { identitiesOf } from '../../sim/travelers/generate';
import { PLACE_LIST } from '../../sim/travelers/lists';
import { dayIndexOf, localMinute } from '../../sim/travelers/schedule';
import { tierNow } from '../../sim/travelers/social';
import type { MemoryEntry } from '../../sim/travelers/types';

/** A row of the friend list (POW-M5-06): who, online or not, where and what they are doing. */
export interface FriendRow {
  slot: number;
  handle: string;
  tier: string;
  online: boolean;
  place: string;
  doing: string;
}

const fill = (t: string, v: Record<string, string>): string =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

const nowMin = (state: SimState): number =>
  state.clock ? localMinute(state.clock.nowMs, state.clock.tzOffsetMin) : 0;

/** The player's friends, online ones first, then by name. */
export function friendRows(state: SimState): FriendRow[] {
  const ids = identitiesOf(state.seed);
  const crowd = state.crowd;
  const now = nowMin(state);
  const out: FriendRow[] = [];
  state.travelers.forEach((life, slot) => {
    if ((life.flags & FLAG.friend) === 0) return;
    const online = crowd?.online[slot] === 1;
    const kind = online ? crowd?.doing[slot]?.kind : undefined;
    const place = PLACE_NAMES[PLACE_LIST[life.place] ?? ''];
    out.push({
      slot,
      handle: ids[slot]!.handle,
      tier: F.tiers[tierNow(life, now)] ?? '',
      online,
      place: place ? fill(F.at, { place }) : '',
      doing: online ? (F.doing[kind ?? ACTIVITIES[life.activity] ?? 'social'] ?? '') : '',
    });
  });
  return out.sort(
    (a, b) => Number(b.online) - Number(a.online) || a.handle.localeCompare(b.handle),
  );
}

/** Travelers who have asked the player to be friends and wait for an answer. */
export function requestRows(state: SimState): { slot: number; handle: string }[] {
  const ids = identitiesOf(state.seed);
  const out: { slot: number; handle: string }[] = [];
  state.travelers.forEach((life, slot) => {
    if ((life.flags & FLAG.requestIn) !== 0) out.push({ slot, handle: ids[slot]!.handle });
  });
  return out;
}

/** A shared-history line in plain words, for the profile card. */
export function memoryLine(state: SimState, m: MemoryEntry): string {
  const kind = MEMORY_KINDS[m.kind] ?? '';
  const t = F.memory[kind];
  if (!t) return '';
  const today = dayIndexOf(nowMin(state));
  return fill(t, {
    subject: subjectName(m.kind, m.subject),
    when: daysAgoText(m.day, today),
  });
}
