import { ITEMS_BALANCE } from '../../content/balance/items';
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
  /** Cook these ingredients at the camp pot in front. Experiments are cooks with no recipe. */
  | { type: 'cook'; items: string[] }
  /**
   * Dialogue with an NPC: enter `node` (choice -1, runs its effects) or pick choice `choice` of it.
   * The sim looks the effects up itself, so only real conversations can change anything.
   */
  | { type: 'talk'; npc: string; node: string; choice: number }
  /** The interface reports that the action a hint asked for happened (the Menu opened). */
  | { type: 'hint'; id: string }
  | { type: 'buy'; shop: string; item: string; qty: number }
  /** Sell from bag slot `slot` to the shop in front of you. */
  | { type: 'sell'; shop: string; slot: number; qty: number };

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
    case 'cook':
      if (
        !Array.isArray(r.items) ||
        r.items.length < 1 ||
        r.items.length > ITEMS_BALANCE.cook.maxIngredients ||
        !r.items.every((i) => typeof i === 'string' && /^item\.[a-z0-9_]{1,40}$/.test(i))
      )
        return { ok: false, reason: 'bad ingredients' };
      return { ok: true, command: { type: 'cook', items: [...(r.items as string[])] } };
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
