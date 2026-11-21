import { describe, expect, it } from 'vitest';
import { EVERY } from '../../src/content/requests/dawnmeadow';
import { REQUESTS } from '../../src/content/requests';
import { THREAD_STAGES, THREADS } from '../../src/content/requests/threads';
import { startRequest } from '../../src/sim/systems/requests';
import { journal, kill, NIGHT_TICK, playRequest, rig, say, state } from '../support/requestPlay';

const stage = (key: string) => EVERY.find((a) => a.key === key)!;

describe('Dawnmeadow Threads (M4-12)', () => {
  it('are five, each a chain of stages that is done by the minutes the ledger counts', () => {
    expect(THREADS).toHaveLength(5);
    for (const t of THREADS) {
      expect(t.estMinutes, t.id).toBe(45);
      const stages = t.stages.map(stage);
      stages.forEach((a, i) => {
        expect(a, `${t.id} stage ${i}`).toBeDefined();
        expect(a.thread?.id).toBe(t.id);
        expect(a.thread?.after).toBe(i === 0 ? undefined : t.stages[i - 1]);
        expect(a.giver, a.key).toBe(t.giver);
      });
      // The stages add up to the Thread's own estimate.
      expect(
        stages.reduce((n, a) => n + a.estMinutes, 0),
        t.id,
      ).toBe(t.estMinutes);
      // The last stage pays the most.
      const coins = stages.map((a) => a.reward.coin);
      expect(Math.max(...coins), t.id).toBe(coins[coins.length - 1]);
    }
    expect(THREAD_STAGES.every((a) => a.thread)).toBe(true);
  });

  it('keep their stages out of the request count: each stage is a request, marked with its Thread', () => {
    for (const a of THREAD_STAGES) {
      const def = REQUESTS[`request.${a.key}`]!;
      expect(def.kind).toBe('authored');
      expect(def.thread).toBe(a.thread!.id);
      expect(a.title.length, a.key).toBeLessThanOrEqual(24);
    }
  });

  it('offer a stage only once the stage before it is done', () => {
    for (const t of THREADS) {
      const r = rig(t.giver);
      const [first, second] = t.stages.map((k) => REQUESTS[`request.${k}`]!);
      // The second is refused until the first is finished.
      expect(startRequest(r.s, r.me, second!), `${t.id} second early`).toBe(false);
      expect(startRequest(r.s, r.me, first!)).toBe(true);
      expect(startRequest(r.s, r.me, second!), `${t.id} second while first is open`).toBe(false);
      void journal(r);
    }
  });

  for (const t of THREADS) {
    it(`${t.title}: plays through, stage by stage, to its end`, () => {
      const night = t.stages.some((k) =>
        stage(k).ways.some((w) => w.steps.some((s) => s.kind === 'defeat' && s.phases)),
      );
      const r = rig(t.giver, night);
      for (const key of t.stages) {
        const a = stage(key);
        // Not offered before its turn, offered at it.
        expect(state(r, `request.${key}`)).toBe('none');
        playRequest(r, a, a.ways[0]!.id);
      }
      for (const key of t.stages) expect(state(r, `request.${key}`)).toBe('done');
    });
  }

  it('Quarry Strike can end either way, with a fight or without one', () => {
    const last = stage('strike_below');
    const kinds = last.ways.map((w) => w.steps.map((s) => s.kind));
    expect(kinds).toContainEqual(['defeat']);
    expect(kinds).toContainEqual(['deliver']);
    for (const w of last.ways) {
      const r = rig('npc.foreman');
      for (const k of ['strike_meal', 'strike_shoring'])
        playRequest(r, stage(k), stage(k).ways[0]!.id);
      playRequest(r, last, w.id);
      expect(state(r, 'request.strike_below')).toBe('done');
    }
  });

  it('Hearthford Watch counts only creatures put down after dark', () => {
    const r = rig('npc.guard');
    r.tick(say('npc.guard', 'watch_1_ask', 0));
    expect(state(r, 'request.watch_1')).toBe('active');
    // By day, two kills do nothing for the watch.
    kill(r, 'creature.mossling');
    kill(r, 'creature.mossling');
    expect(state(r, 'request.watch_1')).toBe('active');
    expect(journal(r).requests['request.watch_1']!.progress).toBe(0);
    // After dark the same kills count.
    r.s.tick = NIGHT_TICK;
    kill(r, 'creature.mossling');
    expect(state(r, 'request.watch_1')).toBe('active');
    kill(r, 'creature.mossling');
    expect(state(r, 'request.watch_1')).toBe('ready');
  });
});
