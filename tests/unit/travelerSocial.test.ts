import { describe, expect, it } from 'vitest';
import { REGARD } from '../../src/content/balance/social';
import { CHIPS, CHIP_SETS, EMOTE_CHIPS, REPLIES, WHISPERS } from '../../src/content/chat/social';
import { CATEGORIES } from '../../src/content/chat/types';
import { FLAG, MEMORY_KINDS } from '../../src/content/travelers/types';
import { createAvatar } from '../../src/sim/avatar';
import { chipsFor, replyFor, whisperFor } from '../../src/sim/chat/social';
import { chatSystem, queueChatCommand, socialSystem } from '../../src/sim/chat/engine';
import { validateCommand } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { findAvatar } from '../../src/shared/summary';
import { createDemoState, type SimState } from '../../src/sim/state';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { identitiesOf, initialLife } from '../../src/sim/travelers/generate';
import {
  isFriend,
  makeFriends,
  regardNow,
  remember,
  tierNow,
  tierOf,
} from '../../src/sim/travelers/social';
import { MEMORY_RING } from '../../src/sim/travelers/types';

const MIN_PER_DAY = 1440;

describe('regard', () => {
  const life = () => initialLife(identitiesOf(1)[0]!);

  it('has the tiers of design/12: Acquaintance at 20, Friend at 60, Close Friend at 140', () => {
    expect([0, 19, 20, 59, 60, 139, 140].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('decays a point a day and never below Acquaintance once reached: a Friend untouched 60 days is still one', () => {
    const l = life();
    makeFriends(l, 1_000_000);
    expect(tierNow(l, 1_000_000)).toBe(2);
    expect(tierNow(l, 1_000_000 + 60 * MIN_PER_DAY)).toBeGreaterThanOrEqual(1);
    expect(regardNow(l, 1_000_000 + 60 * MIN_PER_DAY)).toBe(REGARD.floorOnceKnown);
    // Ten days costs ten points.
    expect(regardNow(l, 1_000_000 + 10 * MIN_PER_DAY)).toBe(
      Math.max(REGARD.floorOnceKnown, l.regardPts - 10),
    );
  });

  it('lets a Stranger fade to nothing, but not below zero', () => {
    const l = life();
    remember(l, 'answered', 0, 1, 1_000_000);
    expect(l.regardPts).toBe(REGARD.weights.answered);
    expect(regardNow(l, 1_000_000 + 30 * MIN_PER_DAY)).toBe(0);
  });

  it('counts a kind of memory for regard once a real day, but still records it', () => {
    const l = life();
    remember(l, 'foughtNear', 3, 100, 1_000_000);
    remember(l, 'foughtNear', 3, 100, 1_000_005);
    expect(l.memory).toHaveLength(2);
    expect(l.regardPts).toBe(REGARD.weights.foughtNear);
    remember(l, 'foughtNear', 3, 101, 1_000_000 + MIN_PER_DAY);
    // The second day's points count in full: less than a day passed since the last contact.
    expect(l.regardPts).toBe(REGARD.weights.foughtNear * 2);
  });
});

describe('memory', () => {
  it('keeps a ring of 24: the 25th entry drops the oldest', () => {
    const l = initialLife(identitiesOf(1)[1]!);
    for (let i = 0; i < MEMORY_RING + 1; i++) remember(l, 'traded', i, 100 + i, 1_000_000);
    expect(l.memory).toHaveLength(MEMORY_RING);
    expect(l.memory[0]!.subject).toBe(1);
    expect(l.memory[MEMORY_RING - 1]!.subject).toBe(MEMORY_RING);
  });

  it('has a weight for every kind of memory', () => {
    for (const k of MEMORY_KINDS) expect(REGARD.weights[k], k).toBeDefined();
  });
});

describe('chips', () => {
  it('are 2 to 4 for every category at every regard tier, none a stranger would not say', () => {
    for (const c of CATEGORIES)
      for (let tier = 0; tier <= 3; tier++) {
        const ids = chipsFor(c, tier);
        expect(ids.length, `${c} tier ${tier}`).toBeGreaterThanOrEqual(2);
        expect(ids.length, `${c} tier ${tier}`).toBeLessThanOrEqual(4);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(CHIPS[id], id).toBeDefined();
        if (tier === 0) expect(ids).not.toContain('joke');
      }
    for (const c of CATEGORIES) expect(CHIP_SETS[c].length).toBeGreaterThanOrEqual(2);
  });

  it('have a reply in every Traveler temper, for every one of the 240, from content', () => {
    const everyChip = [...Object.keys(CHIPS)];
    for (const t of identitiesOf(1)) {
      const d = (): number => 0.5;
      for (const id of everyChip) {
        const r = replyFor(id, t, d);
        expect(r, `${id} for ${t.handle}`).not.toBeNull();
        expect(r!.length).toBeGreaterThan(0);
        // No em dash in anything a player reads.
        expect(r).not.toMatch(/[–—]/);
      }
      for (const k of Object.keys(WHISPERS) as (keyof typeof WHISPERS)[])
        expect(whisperFor(k, t, d).length).toBeGreaterThan(0);
    }
    for (const id of EMOTE_CHIPS) expect(REPLIES[id]!.length).toBeGreaterThan(0);
  });

  it('are validated as commands, and a bad one is dropped', () => {
    expect(validateCommand({ type: 'chip', slot: 3, chip: 'hi' }).ok).toBe(true);
    expect(validateCommand({ type: 'chip', slot: -1, chip: 'hi' }).ok).toBe(false);
    expect(validateCommand({ type: 'chip', slot: 3, chip: 'HI there' }).ok).toBe(false);
    expect(validateCommand({ type: 'friend', slot: 3, op: 'request' }).ok).toBe(true);
    expect(validateCommand({ type: 'friend', slot: 3, op: 'marry' }).ok).toBe(false);
  });
});

// ---- The engine, with a crowd around the player ----

const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const OPEN = { solidAt: (): number => 0 };

function world(seed: number): SimState {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  createAvatar(s, px(192 * 16 + 8), px(193 * 16 + 8));
  s.worldTick = 9000;
  s.weatherOverride = 'clear';
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

interface Spoke {
  slot: number;
  channel: string;
  text: string;
  template: string;
  chips: { id: string; text: string }[];
}

function step(s: SimState, ticks: number, out: Spoke[] = [], inject?: () => SimEvent[]): Spoke[] {
  const base = s.clock!.nowMs;
  const start = s.tick;
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    if (inject) s.events.list.push(...inject());
    travelersSystem(s);
    chatSystem(s);
    socialSystem(s);
    for (const e of s.events.list)
      if (e.type === 'travelerSpoke')
        out.push({
          slot: e.slot,
          channel: e.channel,
          text: e.text,
          template: e.template,
          chips: e.chips,
        });
  }
  return out;
}

describe('chips over a simulated day', () => {
  it('every line that offers chips offers 2 to 4, each with a valid reply for that speaker', () => {
    const s = world(3);
    const ids = identitiesOf(3);
    const seen = step(s, 30 * 60 * 6);
    const offered = seen.filter((l) => l.chips.length > 0);
    expect(offered.length).toBeGreaterThan(0);
    for (const l of offered) {
      expect(l.chips.length).toBeGreaterThanOrEqual(2);
      expect(l.chips.length).toBeLessThanOrEqual(4);
      for (const c of l.chips)
        expect(
          replyFor(c.id, ids[l.slot]!, () => 0.3),
          c.id,
        ).not.toBeNull();
    }
  }, 120_000);
});

describe('a fight near a Traveler, a request, a friend, a login', () => {
  it('ends with a line that brings up the fight', () => {
    const s = world(3);
    const me = findAvatar(s)!;
    step(s, 2400);
    const crowd = crowdOf(s);
    expect(crowd.ents.size).toBeGreaterThan(2);
    // One fight in front of everyone near, from the event. The Travelers who saw it remember it.
    const kill = (): SimEvent[] => [
      { type: 'killed', src: me, dst: 0, kind: 'creature.mossling', tag: '' },
    ];
    step(s, 4, [], kill);
    const knowers = [...crowd.ents.values()]
      .map((e) => e.slot)
      .filter((slot) =>
        s.travelers[slot]!.memory.some((m) => MEMORY_KINDS[m.kind] === 'foughtNear'),
      );
    expect(knowers.length).toBeGreaterThan(0);
    const real = Math.floor(s.clock!.nowMs / 60_000);
    // Regard counts a kind once a day, so a friendship takes days. Give them seven earlier ones.
    for (const slot of knowers)
      for (let d = 1; d <= 7; d++)
        remember(s.travelers[slot]!, 'foughtNear', 0, Math.floor(real / MIN_PER_DAY) - d, real);
    for (const slot of knowers)
      expect(s.travelers[slot]!.regardPts).toBeGreaterThanOrEqual(REGARD.weights.foughtNear * 7);
    // Someone asks, by whisper, with Yes and Maybe-later chips.
    let ask: Spoke | undefined;
    for (let n = 0; n < 240 && !ask; n++)
      ask = step(s, 30).find((l) => l.template === 'whisper.request');
    expect(ask, 'a friend request is whispered').toBeDefined();
    expect(ask!.channel).toBe('whisper');
    expect(ask!.chips.map((c) => c.id)).toEqual(['friend.yes', 'friend.no']);
    const slot = ask!.slot;
    expect(s.travelers[slot]!.flags & FLAG.requestIn).toBeTruthy();
    // The player accepts.
    queueChatCommand(s, { type: 'chip', slot, chip: 'friend.yes' });
    const after: Spoke[] = [];
    step(s, 60, after);
    expect(isFriend(s.travelers[slot]!)).toBe(true);
    expect(s.travelers[slot]!.flags & FLAG.requestIn).toBe(0);
    expect(after.some((l) => l.slot === slot && l.template === 'reply.friend.yes')).toBe(true);
    // Their next session: they log in and whisper, and bring the fight up.
    const crowd2 = crowdOf(s);
    crowd2.online[slot] = 1;
    let line: Spoke | undefined;
    for (let tryNo = 0; tryNo < 40 && !line; tryNo++) {
      s.chat!.said.delete(slot);
      s.chat!.cooldown.clear();
      s.chat!.lastSpoke[slot] = -1e9;
      const got = step(s, 90, [], () => [{ type: 'travelerLoggedIn', slot, place: 0 }]);
      line = got.find((l) => l.slot === slot && l.template === 'whisper.memory');
    }
    expect(line, 'a whisper that brings up the fight').toBeDefined();
    expect(line!.text.toLowerCase()).toMatch(/fight|mossling/);
  }, 180_000);
});

describe('the friend list and the profile card', () => {
  it('lists friends online first, with place and activity, and asks with Accept and Decline', async () => {
    const { friendRows, requestRows, memoryLine } = await import('../../src/ui/menu/friendsModel');
    const { profileOf } = await import('../../src/sim/travelers/entities');
    const s = world(3);
    step(s, 2400);
    const crowd = crowdOf(s);
    const online = [...crowd.ents.values()].map((e) => e.slot);
    const offline = s.travelers.findIndex((_, i) => !crowd.online[i]);
    expect(online.length).toBeGreaterThan(1);
    makeFriends(s.travelers[online[0]!]!, 1_000_000);
    makeFriends(s.travelers[offline]!, 1_000_000);
    s.travelers[online[1]!]!.flags |= FLAG.requestIn;
    const rows = friendRows(s);
    expect(rows.map((r) => r.slot)).toEqual([online[0], offline]);
    expect(rows[0]!.online).toBe(true);
    expect(rows[0]!.doing.length).toBeGreaterThan(0);
    expect(rows[1]!.online).toBe(false);
    expect(requestRows(s).map((r) => r.slot)).toEqual([online[1]]);
    // The card says what is shared in plain words, newest first.
    const life = s.travelers[online[0]!]!;
    remember(life, 'foughtNear', 0, 1, 1_000_000);
    remember(life, 'answered', 0, 2, 1_000_001);
    const card = profileOf(s, online[0]!);
    expect(card.friend).toBe(true);
    expect(card.memory[0]!.kind).toBe(MEMORY_KINDS.indexOf('answered'));
    const lines = card.memory.map((m) => memoryLine(s, m));
    expect(lines.every((l) => l.length > 0 && !/[–—{}]/.test(l))).toBe(true);
    expect(lines.some((l) => /fought a .* near them/.test(l))).toBe(true);
  }, 60_000);
});
