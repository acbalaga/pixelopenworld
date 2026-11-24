import { describe, expect, it } from 'vitest';
import { CHAT } from '../../src/content/balance/chat';
import { CREATURES } from '../../src/content/creatures';
import { GLYPHS } from '../../src/content/chat/glyphs';
import { DUNGEON_NAMES, PLACE_NAMES } from '../../src/content/chat/names';
import { RUMORS } from '../../src/content/chat/rumors';
import { EXCHANGES, TEMPLATES } from '../../src/content/chat/templates';
import {
  validateChat,
  validateShippedChat,
  type ChatContent,
} from '../../src/content/chat/validate';
import { VOICES } from '../../src/content/chat/voices';
import { SKILLS } from '../../src/content/skills';
import { ITEM_STRINGS } from '../../src/content/strings/items';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem, fill } from '../../src/sim/chat/engine';
import { applyVoice, glyphsIn } from '../../src/sim/chat/voice';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, serializeState, type SimState } from '../../src/sim/state';
import { travelersSystem } from '../../src/sim/travelers/crowd';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { weatherOn, dayPhase } from '../../src/sim/time';

const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const shipped: ChatContent = {
  templates: TEMPLATES,
  exchanges: EXCHANGES,
  voices: VOICES,
  glyphs: GLYPHS,
  rumors: RUMORS,
};

describe('chat content', () => {
  it('passes the validator', () => {
    expect(validateShippedChat()).toEqual([]);
  });

  it('has about 120 templates across every category, 16 voices, 12 glyphs and 8 exchanges', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(TEMPLATES.map((t) => t.category)).size).toBeGreaterThanOrEqual(13);
    expect(VOICES).toHaveLength(16);
    expect(GLYPHS).toHaveLength(12);
    expect(EXCHANGES.length).toBeGreaterThanOrEqual(8);
    const wrong = RUMORS.filter((r) => !r.true).length;
    expect(wrong / RUMORS.length).toBeGreaterThan(0.15);
    expect(wrong / RUMORS.length).toBeLessThan(0.4);
  });

  const bad = (patch: Partial<(typeof TEMPLATES)[number]>): string[] =>
    validateChat({
      ...shipped,
      templates: [
        ...TEMPLATES,
        {
          id: 'test.bad',
          category: 'joke',
          channel: 'world',
          trigger: 'state.idle',
          text: ['hello'],
          weight: 1,
          cooldownMin: 1,
          ...patch,
        },
      ],
    });

  it('rejects a slot that the trigger cannot fill', () => {
    expect(bad({ trigger: 'travelerArrived', text: ['sold {item}'] }).join()).toContain(
      'cannot be filled',
    );
    expect(bad({ text: ['hello {nothing}'] }).join()).toContain('unknown slot');
  });
  it('rejects emoji, dashes, real dates and blocked words', () => {
    expect(bad({ text: ['nice \u{1F600}'] }).join()).toContain('emoji');
    expect(bad({ text: ['wait — what'] }).join()).toContain('dash');
    expect(bad({ text: ['see you in March'] }).join()).toContain('date');
    expect(bad({ text: ['since 2019'] }).join()).toContain('date');
    expect(bad({ text: ['you are a f_u_c_k'] }).join()).toContain('blocked');
  });
  it('rejects a place that is not baked (D25) and an unknown glyph', () => {
    expect(bad({ text: ['heading to Saltreach'] }).join()).toContain('unbaked');
    expect(bad({ text: ['nice :nothing:'] }).join()).toContain('unknown glyph');
  });
  it('rejects a glyph that is not eight by eight', () => {
    const g = [{ ...GLYPHS[0]!, rows: ['#', '#'] }, ...GLYPHS.slice(1)];
    expect(validateChat({ ...shipped, glyphs: g }).join()).toContain('8 rows of 8');
  });
});

describe('voices', () => {
  it('make the same filled line four visibly different lines', () => {
    const line = 'hello, I just sold 3 Copper Ingot at 12c each';
    const by = (id: string): string => {
      const v = VOICES.find((x) => x.id === id)!;
      let n = 0;
      // A fixed die: the same roll every time, so the lines are the same on every run.
      return applyVoice(v, line, 'trade', () => (n++ * 0.37 + 0.11) % 1).text;
    };
    const lines = ['lowercase', 'formal', 'glyphy', 'terse'].map(by);
    expect(new Set(lines).size).toBe(4);
    expect(lines).toMatchInlineSnapshot(`
      [
        "hello, i just sold 3 copper ingot at 12c each",
        "Hello, I just sold 3 Copper Ingot at 12c each.",
        "hello, i just sold 3 copper ingot at 12c each! :sparkle:",
        "hi, i sold 3 copper ingot at 12c ea",
      ]
    `);
  });

  it('only ever uses glyphs that exist, and never an emoji', () => {
    const ids = new Set(GLYPHS.map((g) => g.id));
    let n = 0;
    const dice = (): number => (n++ * 0.6180339) % 1;
    for (const v of VOICES)
      for (let i = 0; i < 200; i++) {
        const out = applyVoice(v, 'hello there my friend', 'farewell', dice).text;
        expect(/\p{Extended_Pictographic}/u.test(out)).toBe(false);
        for (const g of glyphsIn(out)) expect(ids.has(g)).toBe(true);
      }
  });

  it('fills slots and drops a template that cannot', () => {
    expect(fill('sold {item} x{qty}', { item: 'Bread', qty: '2' })).toBe('sold Bread x2');
    expect(fill('sold {item}', {})).toBeNull();
  });
});

// ---- Over a simulated stretch ----

interface Line {
  e: Extract<SimEvent, { type: 'travelerSpoke' }>;
  tick: number;
  hour: number;
  stream: SimEvent[][];
}

function world(seed: number, hour = 20): SimState {
  const T0 = (MON + 2) * 86_400_000 + hour * 3_600_000;
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  createAvatar(s, px(3000), px(3000), 'Fred');
  s.clock = { nowMs: T0, epochMs: T0 - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

/** Runs one in-game minute per step. Returns each step's event stream, with the chat system's own events last. */
function run(
  s: SimState,
  minutes: number,
  onStep?: (events: SimEvent[], pre: SimEvent[]) => void,
): void {
  const base = s.clock!.nowMs;
  for (let m = 0; m < minutes; m++) {
    s.tick += 60;
    s.worldTick += 60;
    s.clock = { ...s.clock!, nowMs: base + m * 60_000 };
    s.events.list.length = 0;
    travelersSystem(s);
    const pre = [...s.events.list];
    chatSystem(s);
    onStep?.([...s.events.list], pre);
  }
}

describe('the chat engine over a simulated day', () => {
  const seed = 3;
  const s = world(seed, 6);
  const lines: { e: Line['e']; tick: number }[] = [];
  // The events each tick held when the chat system read them, by tick: what a source id points at.
  const streams = new Map<number, SimEvent[]>();
  run(s, 24 * 60, (all, pre) => {
    streams.set(s.tick, pre);
    for (const e of all) if (e.type === 'travelerSpoke') lines.push({ e, tick: s.tick });
  });
  const names = {
    item: new Set(
      Object.entries(ITEM_STRINGS)
        .filter(([k]) => k.endsWith('.name'))
        .map(([, v]) => v),
    ),
    place: new Set(Object.values(PLACE_NAMES)),
    creature: new Set(Object.values(CREATURES).map((c) => c.name)),
    skill: new Set(Object.values(SKILLS).map((k) => k.name)),
    dungeon: new Set(Object.values(DUNGEON_NAMES)),
  };

  it('says plenty, in both channels, and every line names its source', () => {
    expect(lines.length).toBeGreaterThan(200);
    expect(lines.some((l) => l.e.channel === 'local')).toBe(true);
    for (const l of lines) {
      expect(l.e.source.length).toBeGreaterThan(0);
      expect(l.e.template.length).toBeGreaterThan(0);
    }
  });

  it('carries a source id that exists in that tick event stream', () => {
    for (const l of lines) {
      const src = l.e.source;
      if (src.startsWith('ev:')) {
        const [, tick, idx] = src.split(':');
        // The event the line answers is in the stream of its tick, at that index (a queued fix or reply comes later).
        expect(Number(tick), src).toBeLessThanOrEqual(l.tick);
        const ev = streams.get(Number(tick))?.[Number(idx)];
        expect(ev, src).toBeDefined();
        expect(ev!.type.startsWith('traveler')).toBe(true);
      } else {
        // A state source was announced by a chatSource event, this tick or an earlier one in the queue.
        expect(src.startsWith('state:'), src).toBe(true);
      }
    }
  });

  it('announces each state source before the line it belongs to', () => {
    const announced = new Set<string>();
    const s2 = world(seed, 6);
    run(s2, 6 * 60, (all) => {
      for (const e of all) {
        if (e.type === 'chatSource') announced.add(e.id);
        if (e.type === 'travelerSpoke' && e.source.startsWith('state:'))
          expect(announced.has(e.source), e.source).toBe(true);
      }
    });
  });

  it('references only items, places, creatures, skills and dungeons that exist and are baked', () => {
    for (const l of lines) {
      const sl = l.e.slots;
      if (sl.item !== undefined) expect(names.item.has(sl.item), sl.item).toBe(true);
      if (sl.place !== undefined) expect(names.place.has(sl.place), sl.place).toBe(true);
      if (sl.creature !== undefined)
        expect(names.creature.has(sl.creature), sl.creature).toBe(true);
      if (sl.skill !== undefined) expect(names.skill.has(sl.skill), sl.skill).toBe(true);
      if (sl.dungeon !== undefined) expect(names.dungeon.has(sl.dungeon), sl.dungeon).toBe(true);
    }
  });

  it('says only what the speaker could know: an event line carries that event payload', () => {
    for (const l of lines) {
      if (!l.e.source.startsWith('ev:')) continue;
      const parts = l.e.source.split(':');
      const ev = streams.get(Number(parts[1]))![Number(parts[2])]!;
      const sl = l.e.slots;
      if (ev.type === 'travelerLooted' && sl.item !== undefined)
        expect(sl.item).toBe(ITEM_STRINGS[`${ev.item}.name`]);
      if (ev.type === 'travelerSold' && sl.price !== undefined)
        expect(sl.price).toBe(String(ev.price));
      if (ev.type === 'travelerRankUp' && sl.rank !== undefined)
        expect(sl.rank).toBe(String(ev.points));
      // The actor speaks of its own event. Witness lines are the only ones from someone else.
      if (ev.type !== 'travelerDied' && 'slot' in ev) expect(l.e.slot).toBe(ev.slot);
    }
  });

  it('keeps weather and hour lines true to the sim', () => {
    for (const l of lines) {
      if (l.e.source.startsWith('state:state.weather') && l.e.slots.weather !== undefined) {
        expect(['clear', 'rain', 'storm', 'fog', 'snow', 'heat', 'sandstorm']).toContain(
          l.e.slots.weather,
        );
      }
    }
    expect(weatherOn(s, s.worldTick)).toBeDefined();
    expect(dayPhase(s.worldTick)).toBeDefined();
  });

  it('repeats no template in a channel within its window, replies and fixes aside', () => {
    for (const ch of ['world', 'local'] as const) {
      const ids = lines
        .filter((l) => l.e.channel === ch && !l.e.reply && !l.e.template.startsWith('exchange.'))
        .map((l) => l.e.template);
      for (let i = 0; i < ids.length; i++)
        for (let j = Math.max(0, i - CHAT.windowLines); j < i; j++)
          expect(ids[j] === ids[i], `${ch}: ${ids[i]} at ${i} and ${j}`).toBe(false);
    }
  });

  it('keeps one speaker from talking twice within the gap unless it is a reply', () => {
    const last = new Map<number, number>();
    for (const l of lines) {
      const prev = last.get(l.e.slot);
      if (!l.e.reply && prev !== undefined)
        expect(l.tick - prev, `slot ${l.e.slot}`).toBeGreaterThanOrEqual(CHAT.speakerGapTicks);
      if (!l.e.reply) last.set(l.e.slot, l.tick);
    }
  });

  it('puts local lines in the mouths of Travelers near the player only', () => {
    const crowd = s.crowd!;
    expect(crowd).toBeDefined();
    const ids = identitiesOf(seed);
    for (const l of lines.filter((x) => x.e.channel === 'local'))
      expect(ids[l.e.slot]).toBeDefined();
  });

  it('makes no chat line without a clock, and never touches the sim streams', () => {
    const a = world(7);
    const b = world(7);
    run(a, 120);
    // The same crowd with the chat system left out: the sim is byte-identical.
    const base = b.clock!.nowMs;
    for (let m = 0; m < 120; m++) {
      b.tick += 60;
      b.worldTick += 60;
      b.clock = { ...b.clock!, nowMs: base + m * 60_000 };
      b.events.list.length = 0;
      travelersSystem(b);
    }
    expect(serializeState(a)).toBe(serializeState(b));
    const c = createDemoState(7, 0);
    chatSystem(c);
    expect(c.chat).toBeUndefined();
  });
});

describe('the chat rate through the week', () => {
  it('keeps World chat at 04:00 under a third of its 21:00 rate', () => {
    let night = 0;
    let evening = 0;
    for (let day = 0; day < 7; day++) {
      const T = (MON + day) * 86_400_000;
      for (const [hour, add] of [
        [4, (n: number) => (night += n)],
        [21, (n: number) => (evening += n)],
      ] as const) {
        const s = world(11);
        s.clock = { nowMs: T + hour * 3_600_000, epochMs: T - 5 * 86_400_000, tzOffsetMin: 0 };
        let n = 0;
        // Settle the crowd for an hour of in-game minutes, then count the next hour.
        run(s, 30);
        run(s, 60, (all) => {
          for (const e of all) if (e.type === 'travelerSpoke' && e.channel === 'world') n++;
        });
        add(n);
      }
    }
    expect(evening).toBeGreaterThan(100);
    expect(night / evening).toBeLessThan(1 / 3);
  });
});
