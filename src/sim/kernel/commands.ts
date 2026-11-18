import { CRAFTING } from '../../content/balance/crafting';
import { EQUIP_SLOTS } from '../../content/items/types';
import { isDirection, type Direction } from './fixed';

/** Commands are the only way the outside changes the sim. */
export type Command =
  | {
      type: 'move';
      dir: Direction | null;
      /** Stick held at full extent. Sprint starts after it has been held long enough. */
      full?: boolean;
    }
  /** Classic: one press of the attack button. */
  | { type: 'attack' }
  /** Dodge toward `dir`, or toward the held direction (or facing) when null. */
  | { type: 'dodge'; dir: Direction | null }
  /** Tap in the world at (x, y) px: lock the enemy there, or clear the lock on empty ground. */
  | { type: 'lock'; x: number; y: number }
  /**
   * Technique slot 0 to 3. `press` fires now. `aim` starts holding to aim (aimed techniques) or
   * fires now (others). `release` fires an aimed technique along `aim`.
   */
  | { type: 'technique'; slot: number; phase: 'press' | 'aim' | 'release'; aim: Direction | null }
  | { type: 'scheme'; scheme: 'flow' | 'classic' }
  /** Raise or lower the guard. Raising needs a shield in the off hand. */
  | { type: 'guard'; on: boolean }
  /** The context button: work the node in front, or take the second press of a gather. */
  | { type: 'interact' }
  /** Wear the gear in bag slot `slot`. */
  | { type: 'equip'; slot: number }
  /** Take off worn gear. */
  | { type: 'unequip'; slot: string }
  /** Drop all of bag slot `slot` on the ground. */
  | { type: 'drop'; slot: number }
  /** Move a whole stack between the bag and the storage chest in front: `in` from bag slot `slot`, `out` from chest slot `slot`. */
  | { type: 'store'; dir: 'in' | 'out'; slot: number }
  /** Eat or use the item in bag slot `slot`. */
  | { type: 'use'; slot: number }
  /**
   * Craft from these ingredient units (1 to 4) at the station in front. A known or unknown
   * recipe of the station's craft starts the manual step. No recipe is a failed craft.
   */
  | { type: 'craft'; items: string[] }
  /** Craft with no manual step. For bots, tests and automation: the grade is 0. */
  | { type: 'cook'; items: string[] }
  /** A tap of the manual step. The sim records the tick itself. */
  | { type: 'craftStep' }
  /** Repair the gear in bag slot `slot` at the anvil in front. */
  | { type: 'repair'; slot: number }
  /**
   * Dialogue with an NPC: enter `node` (choice -1, runs its effects) or pick choice `choice` of it.
   * The sim looks the effects up itself, so only real conversations can change anything.
   */
  | { type: 'talk'; npc: string; node: string; choice: number }
  /** The interface reports that the action a hint asked for happened (the Menu opened). */
  | { type: 'hint'; id: string }
  | { type: 'buy'; shop: string; item: string; qty: number }
  /** Sell from bag slot `slot` to the shop in front of you. */
  | { type: 'sell'; shop: string; slot: number; qty: number }
  /** Buy back the stack at `index` of what this shop was sold, at the price it paid. */
  | { type: 'buyback'; shop: string; index: number }
  /** The repair service: mend a carried item (`bag`) or a worn one (`worn`, slot index of the equip slots). */
  | { type: 'mend'; shop: string; from: 'bag' | 'worn'; slot: number }
  /** One step of a haggle (M3-10). `start` needs `item` and `dir`, and `slot` for a sale. */
  | {
      type: 'haggle';
      shop: string;
      step: 'start' | 'low' | 'fair' | 'accept' | 'cancel';
      item?: string;
      dir?: 'buy' | 'sell';
      slot?: number;
    };

/** Result of validating a raw command. */
export type Validated = { ok: true; command: Command } | { ok: false; reason: string };

/** A world coordinate in px: an integer within a generous bound. */
function isCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= 1_000_000;
}

/** Validates untrusted input into a Command. */
export function validateCommand(raw: unknown): Validated {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'not an object' };
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case 'move':
      if (r.full !== undefined && typeof r.full !== 'boolean')
        return { ok: false, reason: 'bad full flag' };
      if (r.dir === null) return { ok: true, command: { type: 'move', dir: null } };
      if (isDirection(r.dir))
        return {
          ok: true,
          command:
            r.full === true
              ? { type: 'move', dir: r.dir, full: true }
              : { type: 'move', dir: r.dir },
        };
      return { ok: false, reason: 'bad direction' };
    case 'attack':
      return { ok: true, command: { type: 'attack' } };
    case 'dodge':
      if (r.dir === null || isDirection(r.dir))
        return { ok: true, command: { type: 'dodge', dir: r.dir } };
      return { ok: false, reason: 'bad direction' };
    case 'lock':
      if (isCoord(r.x) && isCoord(r.y))
        return { ok: true, command: { type: 'lock', x: r.x, y: r.y } };
      return { ok: false, reason: 'bad position' };
    case 'technique':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 3)
        return { ok: false, reason: 'bad slot' };
      if (r.phase !== 'press' && r.phase !== 'aim' && r.phase !== 'release')
        return { ok: false, reason: 'bad phase' };
      if (r.aim !== null && !isDirection(r.aim)) return { ok: false, reason: 'bad direction' };
      return {
        ok: true,
        command: { type: 'technique', slot: r.slot as number, phase: r.phase, aim: r.aim },
      };
    case 'scheme':
      if (r.scheme === 'flow' || r.scheme === 'classic')
        return { ok: true, command: { type: 'scheme', scheme: r.scheme } };
      return { ok: false, reason: 'bad scheme' };
    case 'guard':
      if (typeof r.on !== 'boolean') return { ok: false, reason: 'bad guard' };
      return { ok: true, command: { type: 'guard', on: r.on } };
    case 'interact':
      return { ok: true, command: { type: 'interact' } };
    case 'equip':
    case 'use':
    case 'drop':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 255)
        return { ok: false, reason: 'bad slot' };
      return { ok: true, command: { type: r.type, slot: r.slot as number } };
    case 'store':
      if (r.dir !== 'in' && r.dir !== 'out') return { ok: false, reason: 'bad direction' };
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 255)
        return { ok: false, reason: 'bad slot' };
      return { ok: true, command: { type: 'store', dir: r.dir, slot: r.slot as number } };
    case 'unequip':
      if (typeof r.slot !== 'string' || !EQUIP_SLOTS.includes(r.slot as never))
        return { ok: false, reason: 'bad slot' };
      return { ok: true, command: { type: 'unequip', slot: r.slot } };
    case 'craft':
    case 'cook':
      if (
        !Array.isArray(r.items) ||
        r.items.length < 1 ||
        r.items.length > CRAFTING.maxIngredients ||
        !r.items.every((i) => typeof i === 'string' && /^item\.[a-z0-9_]{1,40}$/.test(i))
      )
        return { ok: false, reason: 'bad ingredients' };
      return { ok: true, command: { type: r.type, items: [...(r.items as string[])] } };
    case 'craftStep':
      return { ok: true, command: { type: 'craftStep' } };
    case 'repair':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 255)
        return { ok: false, reason: 'bad slot' };
      return { ok: true, command: { type: 'repair', slot: r.slot as number } };
    case 'talk': {
      const name = /^[a-z0-9_.]{1,60}$/;
      if (typeof r.npc !== 'string' || !name.test(r.npc) || typeof r.node !== 'string')
        return { ok: false, reason: 'bad dialogue' };
      if (!name.test(r.node)) return { ok: false, reason: 'bad dialogue' };
      if (!Number.isInteger(r.choice) || (r.choice as number) < -1 || (r.choice as number) > 15)
        return { ok: false, reason: 'bad choice' };
      return {
        ok: true,
        command: { type: 'talk', npc: r.npc, node: r.node, choice: r.choice as number },
      };
    }
    case 'hint':
      if (typeof r.id !== 'string' || !/^hint\.[a-z_]{1,24}$/.test(r.id))
        return { ok: false, reason: 'bad hint' };
      return { ok: true, command: { type: 'hint', id: r.id } };
    case 'buy':
    case 'sell': {
      if (typeof r.shop !== 'string' || !/^shop\.[a-z0-9_]{1,40}$/.test(r.shop))
        return { ok: false, reason: 'bad shop' };
      if (!Number.isInteger(r.qty) || (r.qty as number) < 1 || (r.qty as number) > 99)
        return { ok: false, reason: 'bad quantity' };
      if (r.type === 'buy') {
        if (typeof r.item !== 'string' || !/^item\.[a-z0-9_]{1,40}$/.test(r.item))
          return { ok: false, reason: 'bad item' };
        return {
          ok: true,
          command: { type: 'buy', shop: r.shop, item: r.item, qty: r.qty as number },
        };
      }
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 255)
        return { ok: false, reason: 'bad slot' };
      return {
        ok: true,
        command: { type: 'sell', shop: r.shop, slot: r.slot as number, qty: r.qty as number },
      };
    }
    case 'buyback':
    case 'mend':
    case 'haggle': {
      if (typeof r.shop !== 'string' || !/^shop\.[a-z0-9_]{1,40}$/.test(r.shop))
        return { ok: false, reason: 'bad shop' };
      const small = (n: unknown): n is number =>
        Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 255;
      if (r.type === 'buyback') {
        if (!small(r.index)) return { ok: false, reason: 'bad index' };
        return { ok: true, command: { type: 'buyback', shop: r.shop, index: r.index } };
      }
      if (r.type === 'mend') {
        if (r.from !== 'bag' && r.from !== 'worn') return { ok: false, reason: 'bad source' };
        if (!small(r.slot)) return { ok: false, reason: 'bad slot' };
        return { ok: true, command: { type: 'mend', shop: r.shop, from: r.from, slot: r.slot } };
      }
      const steps = ['start', 'low', 'fair', 'accept', 'cancel'];
      if (typeof r.step !== 'string' || !steps.includes(r.step))
        return { ok: false, reason: 'bad step' };
      const cmd: Extract<Command, { type: 'haggle' }> = {
        type: 'haggle',
        shop: r.shop,
        step: r.step as 'start',
      };
      if (r.step === 'start') {
        if (r.dir !== 'buy' && r.dir !== 'sell') return { ok: false, reason: 'bad direction' };
        cmd.dir = r.dir;
        if (r.dir === 'buy') {
          if (typeof r.item !== 'string' || !/^item\.[a-z0-9_]{1,40}$/.test(r.item))
            return { ok: false, reason: 'bad item' };
          cmd.item = r.item;
        } else {
          if (!small(r.slot)) return { ok: false, reason: 'bad slot' };
          cmd.slot = r.slot;
        }
      }
      return { ok: true, command: cmd };
    }
    default:
      return { ok: false, reason: 'unknown command type' };
  }
}

/** Handler applied to each validated command. */
export type CommandHandler<S> = (state: S, command: Command) => void;

/**
 * The validated dispatch point. Invalid commands are dropped and counted, never thrown,
 * so a bad input cannot crash a tick. Returns the number rejected.
 */
export function dispatch<S>(state: S, raws: readonly unknown[], handle: CommandHandler<S>): number {
  let rejected = 0;
  for (const raw of raws) {
    const v = validateCommand(raw);
    if (v.ok) handle(state, v.command);
    else rejected++;
  }
  return rejected;
}
