import { describe, expect, it } from 'vitest';
import { SAMPLE_BOSS } from '../../src/content/creatures/bosses/sample';
import { createAvatar } from '../../src/sim/avatar';
import { getComp, query } from '../../src/sim/kernel/entities';
import { emit, type SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { addItem } from '../../src/sim/items';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { bossSystem, spawnBoss } from '../../src/sim/systems/boss';
import { dungeonSystem } from '../../src/sim/systems/dungeon';
import { itemsSystem } from '../../src/sim/systems/items';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { kill } from '../../src/sim/combat/fighter';

function fight(): { s: SimState; me: number; boss: number; log: SimEvent[] } {
  const s = createDemoState(21, 0);
  const me = createAvatar(s, px(200), px(300));
  const boss = spawnBoss(s, 'boss.sample', 300, 300);
  return { s, me, boss, log: [] };
}

/** One full tick, keeping the events it produced. */
function tick(f: ReturnType<typeof fight>, ...extra: SimEvent[]): void {
  stepWorld(f.s, f.me, { commands: [] });
  for (const e of extra) emit(f.s.events, e);
  f.log.push(...f.s.events.list);
}

const hpPct = (f: ReturnType<typeof fight>, pct: number): void => {
  const p = getComp(f.s.entities, f.boss, 'pools')!;
  p.hp = Math.floor((p.hpMax * pct) / 100);
};
const bossOf = (f: ReturnType<typeof fight>) => getComp(f.s.entities, f.boss, 'boss')!;
const count = (f: ReturnType<typeof fight>, type: SimEvent['type']): number =>
  f.log.filter((e) => e.type === type).length;

describe('boss framework', () => {
  it('the sample boss has three phases', () => {
    expect(SAMPLE_BOSS.phases).toHaveLength(3);
  });

  it('enters each phase at its Health, only forward', () => {
    const f = fight();
    tick(f);
    expect(bossOf(f).phase).toBe(0);
    hpPct(f, 60);
    tick(f);
    expect(bossOf(f).phase).toBe(1);
    // Health back above the threshold does not undo a phase.
    hpPct(f, 90);
    tick(f);
    expect(bossOf(f).phase).toBe(1);
    expect(count(f, 'bossPhase')).toBe(1);
  });

  it('runs its pattern in order: attack, wait, next attack', () => {
    const f = fight();
    // The avatar stands in view. Aim at it and watch the attacks the boss starts.
    const started: string[] = [];
    for (let i = 0; i < 400; i++) {
      tick(f);
      for (const e of f.s.events.list)
        if (e.type === 'attackStarted' && e.id === f.boss) started.push(e.attack);
      // Keep the avatar alive and in place.
      const pools = getComp(f.s.entities, f.me, 'pools')!;
      pools.hp = pools.hpMax;
    }
    expect(started.slice(0, 4)).toEqual([
      'attack.boss_gore',
      'attack.boss_charge',
      'attack.boss_gore',
      'attack.boss_charge',
    ]);
  });

  it('holds Health at a gate until its event, then lets it fall', () => {
    const f = fight();
    hpPct(f, 60);
    tick(f);
    expect(bossOf(f).phase).toBe(1);
    hpPct(f, 5);
    tick(f);
    const pools = getComp(f.s.entities, f.boss, 'pools')!;
    expect(pools.hp).toBe(Math.ceil((pools.hpMax * 40) / 100));
    // The switch is thrown: the gate lifts. Phase three starts below a third.
    const sw = spawnFixture(f.s, 'fixture.switch', 5, 5);
    getComp(f.s.entities, sw, 'fixture')!.open = true;
    // The event reaches the boss system within the tick it happens in.
    emit(f.s.events, { type: 'switchChanged', id: sw, on: true });
    bossSystem(f.s);
    tick(f);
    hpPct(f, 20);
    tick(f);
    expect(getComp(f.s.entities, f.boss, 'pools')!.hp).toBeLessThan(pools.hpMax * 0.4);
    expect(bossOf(f).phase).toBe(2);
  });

  it('hazards telegraph, then hurt an avatar standing on a marked tile, once per activation', () => {
    const f = fight();
    hpPct(f, 60);
    tick(f);
    const home = getComp(f.s.entities, f.boss, 'ai')!.home;
    const me = getComp(f.s.entities, f.me, 'pos')!;
    // The first hazard tile is 2 tiles east of the boss's home.
    me.x = home.x + px(32);
    me.y = home.y;
    const pools = getComp(f.s.entities, f.me, 'pools')!;
    const start = pools.hp;
    // Telegraph: 30 ticks of nothing, then 15 active ticks.
    const phaseTick = bossOf(f).phaseTick;
    while (f.s.tick - phaseTick < 25) {
      tick(f);
      me.x = home.x + px(32);
      me.y = home.y;
    }
    expect(pools.hp).toBe(start);
    while (f.s.tick - phaseTick < 50) {
      tick(f);
      me.x = home.x + px(32);
      me.y = home.y;
    }
    expect(pools.hp).toBe(start - SAMPLE_BOSS.phases[1]!.hazards![0]!.damage);
  });

  describe('two ways to end it', () => {
    it('by fight: the boss falls, the dungeon clears, the reward drops', () => {
      const f = fight();
      tick(f);
      // Systems run on this tick's events, as they do inside a tick: the death, then the rest.
      kill(f.s, f.boss);
      bossSystem(f.s);
      dungeonSystem(f.s);
      itemsSystem(f.s);
      f.log.push(...f.s.events.list);
      expect(bossOf(f).resolved).toBe('fight');
      expect(f.log.some((e) => e.type === 'bossResolved' && e.how === 'fight')).toBe(true);
      expect(count(f, 'dungeonCleared')).toBe(1);
      expect(query(f.s.entities, 'pickup').length).toBeGreaterThan(0);
    });

    it('by objective: the steps in order end it with the same reward and another line', () => {
      const f = fight();
      tick(f);
      // Steps out of order do nothing: the key alone does not finish it.
      addItem(getComp(f.s.entities, f.me, 'inventory')!, 'item.old_key', 1);
      tick(f);
      expect(bossOf(f).done).toEqual([]);
      // Open the gate, and both steps fall in order.
      const gate = spawnFixture(f.s, 'fixture.gate_switch', 8, 8);
      getComp(f.s.entities, gate, 'fixture')!.open = true;
      tick(f);
      expect(bossOf(f).done).toEqual(['open_gate', 'bring_key']);
      expect(bossOf(f).resolved).toBe('objective');
      expect(f.log.some((e) => e.type === 'bossResolved' && e.how === 'objective')).toBe(true);
      expect(count(f, 'dungeonCleared')).toBe(1);
      // The boss is gone from the fight the same way a kill leaves it, and the table pays.
      expect(getComp(f.s.entities, f.boss, 'fighter')?.state).toBe('dead');
      expect(query(f.s.entities, 'pickup').length).toBeGreaterThan(0);
      // A different title line is named for each way.
      expect(SAMPLE_BOSS.objective!.title).not.toBe(SAMPLE_BOSS.title);
    });
  });
});
