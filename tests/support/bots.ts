import { CREATURES } from '../../src/content/creatures';
import { ITEMS } from '../../src/content/items';
import { JsonCodec } from '../../src/save/codec';
import { SaveManager, type LoadResult } from '../../src/save/manager';
import { MemoryStorage } from '../../src/save/storage';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { spawnCampPot, spawnNode } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import { query } from '../../src/sim/kernel/entities';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { LOOK, T0 } from './saves';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 90 || ty > 90 ? 1 : 0),
};

export const TPS = 30;
/** Facing: N, E, S, W. */
export const N = 0;
export const E = 2;
export const S = 4;
export const W = 6;

/** A snapshot taken during a run, and what the loader made of it. */
export interface Snapshot {
  tick: number;
  seq: number;
  loaded: LoadResult;
}

/**
 * A scripted player running the real sim in an open field. Everything that changes the state
 * goes through commands and the same systems the game runs; the only liberties are standing the
 * avatar next to what it wants (the harness has no pathfinding) and placing foes in front of it.
 * Saves go through `SaveManager`, and every snapshot is loaded back, which runs the validator.
 */
export class Run {
  readonly s: SimState;
  readonly me: number;
  readonly storage = new MemoryStorage();
  readonly mgr: SaveManager;
  readonly snapshots: Snapshot[] = [];
  /** Wall clock ms added on top of play time: time spent with the game closed. */
  offlineMs = 0;
  events: SimEvent[] = [];
  private lastCommit = 0;

  constructor(seed: number) {
    this.s = createDemoState(seed, 0);
    this.s.world = OPEN;
    const f = feetAt(30, 30);
    this.me = createAvatar(this.s, f.x, f.y, 'Bot_1');
    this.mgr = new SaveManager({
      codec: new JsonCodec(),
      storage: this.storage,
      now: () => T0 + (this.s.tick / TPS) * 1000 + this.offlineMs,
      newId: () => 'bb'.repeat(16),
    });
    // The world: a shopkeeper, the guard, a camp pot, herb patches and berry bushes.
    spawnNpc(this.s, 'npc.shopkeeper', 33, 30);
    spawnNpc(this.s, 'npc.guard', 30, 33);
    spawnCampPot(this.s, 30 * 16 + 8, 26 * 16 + 14);
    for (const y of [30, 32, 34]) spawnNode(this.s, 'node.herb_patch', 25 * 16 + 8, y * 16 + 14);
    for (const y of [30, 32]) spawnNode(this.s, 'node.berry_bush', 21 * 16 + 8, y * 16 + 14);
    this.tick({ type: 'scheme', scheme: 'classic' });
  }

  get ticks(): number {
    return this.s.tick;
  }

  tick(...cmds: Command[]): void {
    stepWorld(this.s, this.me, { commands: cmds });
    this.events.push(...this.s.events.list);
    if (this.events.length > 5000) this.events = this.events.slice(-1000);
  }

  run(n: number, ...cmds: Command[]): void {
    for (let i = 0; i < n; i++) this.tick(...(i === 0 ? cmds : []));
  }

  get hp(): number {
    return this.s.entities.comps.pools[this.me]?.hp ?? 0;
  }

  get dead(): boolean {
    return this.s.entities.comps.fighter[this.me]?.state === 'dead';
  }

  /** Puts the avatar on a tile, facing a direction. */
  stand(tx: number, ty: number, facing: 0 | 2 | 4 | 6): void {
    const f = feetAt(tx, ty);
    const p = this.s.entities.comps.pos[this.me]!;
    p.x = f.x;
    p.y = f.y;
    this.s.entities.comps.vel[this.me] = { x: 0, y: 0 };
    this.s.entities.comps.avatar[this.me]!.facing = facing;
  }

  private slotOf(pred: (item: string) => boolean): number {
    return this.s.entities.comps.inventory[this.me]!.slots.findIndex((x) => x && pred(x.item));
  }

  count(item: string): number {
    return this.s.entities.comps.inventory[this.me]!.slots.reduce(
      (n, x) => n + (x?.item === item ? x.qty : 0),
      0,
    );
  }

  /** Eats the first food in the bag. */
  eat(): void {
    const slot = this.slotOf((i) => !!ITEMS[i]?.food);
    if (slot >= 0) this.tick({ type: 'use', slot });
  }

  /** Spawns a creature one tile east of the avatar and swings until one of them is down. */
  fight(
    kind: string,
    opts: { hpOverride?: number; maxTicks?: number; eatBelow?: number } = {},
  ): void {
    if (this.dead) return;
    this.stand(30, 30, E);
    const here = this.s.entities.comps.pos[this.me]!;
    const foe = spawnCreature(
      this.s,
      kind,
      Math.round(here.x / 256) + 16,
      Math.round(here.y / 256),
    );
    if (opts.hpOverride) this.s.entities.comps.pools[foe]!.hp = opts.hpOverride;
    const max = opts.maxTicks ?? 900;
    for (let i = 0; i < max; i++) {
      if (!this.s.entities.alive[foe] || this.s.entities.comps.fighter[foe]?.state === 'dead')
        break;
      if (this.dead) break;
      if (opts.eatBelow !== undefined && this.hp < opts.eatBelow && i % 20 === 0) this.eat();
      this.tick({ type: 'attack' });
      if (i % 45 === 20) this.tick({ type: 'dodge', dir: null });
    }
    this.run(90);
  }

  /** Waits out a death, walks back to the echo, and takes it. */
  recover(): void {
    for (let i = 0; i < 400 && this.dead; i++) this.tick();
    this.run(60);
    for (const id of query(this.s.entities, 'echo')) {
      const p = this.s.entities.comps.pos[id]!;
      const f = this.s.entities.comps.pos[this.me]!;
      f.x = p.x;
      f.y = p.y;
      this.run(30);
    }
  }

  talk(npc: string, node: string, choice: number): void {
    const at = npc === 'npc.guard' ? [30, 32] : [32, 30];
    this.stand(at[0]!, at[1]!, 0);
    this.tick({ type: 'talk', npc, node, choice });
  }

  sellAll(item: string): void {
    this.stand(32, 30, 2);
    const slot = this.slotOf((i) => i === item);
    if (slot < 0) return;
    const qty = this.s.entities.comps.inventory[this.me]!.slots[slot]!.qty;
    this.tick({ type: 'sell', shop: 'shop.brin', slot, qty });
  }

  buy(item: string, qty: number): void {
    this.stand(32, 30, 2);
    this.tick({ type: 'buy', shop: 'shop.brin', item, qty });
  }

  /** Works a node: starts the sweep, and either takes the sweet spot or lets it run out. */
  gather(tx: number, ty: number, sweet: boolean): void {
    this.stand(tx + 1, ty, W);
    this.tick({ type: 'interact' });
    if (sweet) {
      this.run(14);
      this.tick({ type: 'interact' });
    }
    this.run(30);
  }

  cook(items: string[]): void {
    this.stand(30, 27, N);
    this.tick({ type: 'cook', items });
    this.run(20);
  }

  /** Runs east and back at a full stick, for sprint XP. */
  sprint(ticks: number): void {
    this.stand(10, 30, E);
    this.run(ticks, { type: 'move', dir: E, full: true });
    this.tick({ type: 'move', dir: null });
    this.run(10);
  }

  openChest(): void {
    spawnFixture(this.s, 'fixture.chest_side', 50, 40);
    this.stand(51, 40, W);
    this.tick({ type: 'move', dir: W });
    this.tick({ type: 'move', dir: null });
    this.tick({ type: 'interact' });
    this.run(10);
  }

  wearBest(): void {
    const inv = this.s.entities.comps.inventory[this.me]!;
    inv.slots.forEach((x, slot) => {
      if (x && ITEMS[x.item]?.equip) this.tick({ type: 'equip', slot });
    });
  }

  /** Writes a snapshot when a minute of play has passed, then loads it back through the validator. */
  async autosave(everyTicks = 60 * TPS): Promise<void> {
    if (this.s.tick - this.lastCommit < everyTicks && this.snapshots.length > 0) return;
    await this.save();
  }

  async save(): Promise<void> {
    this.lastCommit = this.s.tick;
    const seq = await this.mgr.commit({
      sim: this.s,
      look: LOOK,
      playSeconds: this.s.tick / TPS,
    });
    const loaded = await this.mgr.load();
    this.snapshots.push({ tick: this.s.tick, seq, loaded: loaded! });
  }

  /** The game is closed for a while: wall time passes and no ticks do. */
  closeFor(hours: number): void {
    this.offlineMs += hours * 3600 * 1000;
  }
}

export const MOSSLING = 'creature.mossling';
export const BOAR = 'creature.bramble_boar';
export const BOSS = 'creature.old_bramblehide';
export const SPITBLOOM = 'creature.spitbloom';
export const KINDS = Object.keys(CREATURES);
