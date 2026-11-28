import { CRAFTING } from '../../content/balance/crafting';
import { MAP_BALANCE } from '../../content/balance/map';
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
  | { type: 'trash'; slot: number }
  /** Move a whole stack between the bag and the storage chest in front: `in` from bag slot `slot`, `out` from chest slot `slot`. */
  | { type: 'store'; dir: 'in' | 'out'; slot: number }
  /** Eat or use the item in bag slot `slot`. */
  | { type: 'use'; slot: number }
  /** Feed the item in bag slot `slot` to the creature in front (M4-05). */
  | { type: 'feed'; slot: number }
  /**
   * Craft from these ingredient units (1 to 4) at the station in front. A known or unknown
   * recipe of the station's craft starts the manual step. No recipe is a failed craft.
   */
  | { type: 'craft'; items: string[] }
  /** Craft with no manual step. For bots, tests and automation: the grade is 0. */
  | { type: 'cook'; items: string[] }
  /** A tap of the manual step. The sim records the tick itself. */
  | { type: 'craftStep' }
  /** A trace step's pointer, in a 1000 by 1000 space. */
  | { type: 'craftPoint'; x: number; y: number }
  /** A hold step's pointer goes down or up. */
  | { type: 'craftHold'; on: boolean }
  /** Fishing (M6-05): the line is held (reeling up) or let go. */
  | { type: 'reel'; on: boolean }
  /** Repair the gear in bag slot `slot` at the anvil in front. */
  | { type: 'repair'; slot: number }
  /**
   * Dialogue with an NPC: enter `node` (choice -1, runs its effects) or pick choice `choice` of it.
   * The sim looks the effects up itself, so only real conversations can change anything.
   */
  | { type: 'talk'; npc: string; node: string; choice: number }
  /** The interface reports that the action a hint asked for happened (the Menu opened). */
  | { type: 'hint'; id: string }
  /** Answer a Traveler with a reply chip or an emote (M5-06). The sim checks the chip is on offer. */
  | { type: 'chip'; slot: number; chip: string }
  /** Read a letter, or claim its attachment, once (M5-12). */
  | { type: 'mail'; op: 'read' | 'claim'; id: number }
  /** The party finder and the party frames (M5-07). */
  | { type: 'party'; op: 'post' | 'join' | 'leave' | 'cancel'; activity?: string; slot?: number }
  /** Guilds (M5-08): leave, move a stack in or out of the stash, give to a goal, take its pay, ask a member. */
  | {
      type: 'guild';
      op: 'leave' | 'stash' | 'give' | 'claim';
      dir?: 'in' | 'out';
      slot?: number;
      goal?: number;
    }
  | { type: 'guildAsk'; slot: number }
  /** The market terminal (M5-10): list from a bag slot, take a listing down, buy from a Traveler. */
  | {
      type: 'market';
      op: 'list' | 'cancel' | 'buy';
      slot?: number;
      qty?: number;
      price?: number;
      id?: number;
      item?: string;
      seller?: number;
    }
  /** A plot of the reeve's field (M6-02): till, plant from a bag slot, water, fertilize, harvest. */
  | {
      type: 'farm';
      op: 'till' | 'plant' | 'water' | 'fertilize' | 'harvest';
      plot: number;
      slot?: number;
    }
  /** Share a dish from the Bag with a Traveler here (M6-04, the "Share food" chip). */
  | { type: 'shareFood'; slot: number }
  /** Challenge a Traveler to a duel (M5-12). */
  | { type: 'duel'; slot: number }
  /** Poke a sleeping Traveler awake (M5-31). */
  | { type: 'poke'; slot: number }
  /** A friend action on a Traveler, from the profile card or a request (M5-06). */
  | { type: 'friend'; slot: number; op: 'request' | 'accept' | 'decline' | 'remove' }
  | { type: 'buy'; shop: string; item: string; qty: number }
  /** Sell from bag slot `slot` to the shop in front of you. */
  | { type: 'sell'; shop: string; slot: number; qty: number }
  /** At a bed: sleep, wear or take off a Path, choose the title shown. */
  | { type: 'sleep' }
  | { type: 'wearPath'; path: string; on: boolean }
  | { type: 'showPath'; path: string | null }
  /** Take a request posted on the board in front of the avatar. */
  | { type: 'takeRequest'; board: string; id: string }
  /** Turn in a finished request that a board gave, at that board. */
  | { type: 'turnInRequest'; id: string }
  /** Pin a request to the HUD, or clear the pin. */
  | { type: 'pinRequest'; id: string | null }
  /** Swap to the other loadout (the HUD swap button). */
  | { type: 'loadout' }
  /** Put a known technique in slot 1, 2 or 3 (the second to fourth button), or empty it. */
  | { type: 'assign'; slot: number; technique: string | null }
  /** Buy back the stack at `index` of what this shop was sold, at the price it paid. */
  | { type: 'buyback'; shop: string; index: number }
  /** The repair service: mend a carried item (`bag`) or a worn one (`worn`, slot index of the equip slots). */
  | { type: 'mend'; shop: string; from: 'bag' | 'worn'; slot: number }
  /** Leave a note on the map at world tile (x, y) (M4-06). */
  | { type: 'noteAdd'; x: number; y: number; text: string }
  /** Travel to an attuned Waystone of the region by its id (M4-07). */
  | { type: 'travel'; stone: string }
  /** Remove a note by id. */
  | { type: 'noteRemove'; id: number }
  /** One step of a haggle (M3-10). `start` needs `item` and `dir`, and `slot` for a sale. */
  | {
      type: 'haggle';
      shop: string;
      step: 'start' | 'low' | 'fair' | 'accept' | 'cancel';
      item?: string;
      dir?: 'buy' | 'sell';
      slot?: number;
    };

/**
 * A note's text as the sim keeps it: whitespace collapsed, ends trimmed, at most `maxLength`
 * characters, no control characters. Null if nothing is left. The same rule runs in the Menu, so
 * what the player sees is what is saved.
 */
export function cleanNoteText(raw: string): string | null {
  const spaced = Array.from(raw)
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return c < 32 || (c >= 127 && c <= 159) || c === 0x2028 || c === 0x2029 ? ' ' : ch;
    })
    .join('');
  const t = spaced.replace(/\s+/g, ' ').trim();
  const cut = Array.from(t).slice(0, MAP_BALANCE.notes.maxLength).join('').trim();
  return cut.length > 0 ? cut : null;
}

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
    case 'feed':
    case 'drop':
    case 'trash':
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
    case 'craftPoint':
      if (
        !Number.isFinite(r.x) ||
        !Number.isFinite(r.y) ||
        (r.x as number) < -1000 ||
        (r.x as number) > 2000 ||
        (r.y as number) < -1000 ||
        (r.y as number) > 2000
      )
        return { ok: false, reason: 'bad point' };
      return { ok: true, command: { type: 'craftPoint', x: r.x as number, y: r.y as number } };
    case 'craftHold':
      if (typeof r.on !== 'boolean') return { ok: false, reason: 'bad hold' };
      return { ok: true, command: { type: 'craftHold', on: r.on } };
    case 'reel':
      if (typeof r.on !== 'boolean') return { ok: false, reason: 'bad reel' };
      return { ok: true, command: { type: 'reel', on: r.on } };
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
    case 'chip':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 4095)
        return { ok: false, reason: 'bad traveler' };
      if (typeof r.chip !== 'string' || !/^[a-z]{1,12}(\.[a-z]{1,12})?$/.test(r.chip))
        return { ok: false, reason: 'bad chip' };
      return { ok: true, command: { type: 'chip', slot: r.slot as number, chip: r.chip } };
    case 'mail':
      if (r.op !== 'read' && r.op !== 'claim') return { ok: false, reason: 'bad mail action' };
      if (!Number.isInteger(r.id) || (r.id as number) < 1 || (r.id as number) > 1_000_000)
        return { ok: false, reason: 'bad letter' };
      return { ok: true, command: { type: 'mail', op: r.op, id: r.id as number } };
    case 'guild': {
      const op = r.op;
      if (op !== 'leave' && op !== 'stash' && op !== 'give' && op !== 'claim')
        return { ok: false, reason: 'bad guild action' };
      if (op === 'leave') return { ok: true, command: { type: 'guild', op } };
      if (op === 'stash') {
        if (r.dir !== 'in' && r.dir !== 'out') return { ok: false, reason: 'bad stash move' };
        if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 63)
          return { ok: false, reason: 'bad slot' };
        return { ok: true, command: { type: 'guild', op, dir: r.dir, slot: r.slot as number } };
      }
      if (!Number.isInteger(r.goal) || (r.goal as number) < 0 || (r.goal as number) > 7)
        return { ok: false, reason: 'bad goal' };
      return { ok: true, command: { type: 'guild', op, goal: r.goal as number } };
    }
    case 'market': {
      const n = (v: unknown, max: number): boolean =>
        Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
      if (r.op === 'list') {
        if (!n(r.slot, 63) || !n(r.qty, 999) || !n(r.price, 1_000_000))
          return { ok: false, reason: 'bad listing' };
        return {
          ok: true,
          command: {
            type: 'market',
            op: 'list',
            slot: r.slot as number,
            qty: r.qty as number,
            price: r.price as number,
          },
        };
      }
      if (r.op === 'cancel') {
        if (!n(r.id, 1_000_000)) return { ok: false, reason: 'bad listing' };
        return { ok: true, command: { type: 'market', op: 'cancel', id: r.id as number } };
      }
      if (r.op === 'buy') {
        if (typeof r.item !== 'string' || !/^item\.[a-z0-9_]{1,40}$/.test(r.item))
          return { ok: false, reason: 'bad item' };
        if (!n(r.seller, 4095) || !n(r.qty, 999)) return { ok: false, reason: 'bad buy' };
        return {
          ok: true,
          command: {
            type: 'market',
            op: 'buy',
            item: r.item,
            seller: r.seller as number,
            qty: r.qty as number,
          },
        };
      }
      return { ok: false, reason: 'bad market action' };
    }
    case 'farm': {
      const ops = ['till', 'plant', 'water', 'fertilize', 'harvest'] as const;
      const op = ops.find((o) => o === r.op);
      if (!op) return { ok: false, reason: 'bad farm action' };
      if (!Number.isInteger(r.plot) || (r.plot as number) < 0 || (r.plot as number) > 63)
        return { ok: false, reason: 'bad plot' };
      if (op !== 'plant')
        return { ok: true, command: { type: 'farm', op, plot: r.plot as number } };
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 63)
        return { ok: false, reason: 'bad slot' };
      return {
        ok: true,
        command: { type: 'farm', op, plot: r.plot as number, slot: r.slot as number },
      };
    }
    case 'shareFood':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 4095)
        return { ok: false, reason: 'bad traveler' };
      return { ok: true, command: { type: 'shareFood', slot: r.slot as number } };
    case 'guildAsk':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 4095)
        return { ok: false, reason: 'bad traveler' };
      return { ok: true, command: { type: 'guildAsk', slot: r.slot as number } };
    case 'party': {
      if (r.op !== 'post' && r.op !== 'join' && r.op !== 'leave' && r.op !== 'cancel')
        return { ok: false, reason: 'bad party action' };
      if (r.op === 'post') {
        if (typeof r.activity !== 'string' || !/^[a-z]+(\.[a-z0-9_]+){1,3}$/.test(r.activity))
          return { ok: false, reason: 'bad activity' };
        return { ok: true, command: { type: 'party', op: 'post', activity: r.activity } };
      }
      if (r.op === 'join') {
        if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 4095)
          return { ok: false, reason: 'bad traveler' };
        return { ok: true, command: { type: 'party', op: 'join', slot: r.slot as number } };
      }
      return { ok: true, command: { type: 'party', op: r.op } };
    }
    case 'duel':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 4095)
        return { ok: false, reason: 'bad traveler' };
      return { ok: true, command: { type: 'duel', slot: r.slot as number } };
    case 'poke':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 4095)
        return { ok: false, reason: 'bad traveler' };
      return { ok: true, command: { type: 'poke', slot: r.slot as number } };
    case 'friend':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 4095)
        return { ok: false, reason: 'bad traveler' };
      if (r.op !== 'request' && r.op !== 'accept' && r.op !== 'decline' && r.op !== 'remove')
        return { ok: false, reason: 'bad friend action' };
      return { ok: true, command: { type: 'friend', slot: r.slot as number, op: r.op } };
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
    case 'loadout':
      return { ok: true, command: { type: 'loadout' } };
    case 'noteAdd': {
      if (!isCoord(r.x) || !isCoord(r.y)) return { ok: false, reason: 'bad position' };
      const text = typeof r.text === 'string' ? cleanNoteText(r.text) : null;
      if (text === null) return { ok: false, reason: 'bad note' };
      return { ok: true, command: { type: 'noteAdd', x: r.x, y: r.y, text } };
    }
    case 'travel':
      if (typeof r.stone !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(r.stone))
        return { ok: false, reason: 'bad stone' };
      return { ok: true, command: { type: 'travel', stone: r.stone } };
    case 'noteRemove':
      if (!Number.isInteger(r.id) || (r.id as number) < 1 || (r.id as number) > 1_000_000)
        return { ok: false, reason: 'bad note' };
      return { ok: true, command: { type: 'noteRemove', id: r.id as number } };
    case 'sleep':
      return { ok: true, command: { type: 'sleep' } };
    case 'takeRequest':
      if (typeof r.board !== 'string' || !/^board\.[a-z0-9_]{1,40}$/.test(r.board))
        return { ok: false, reason: 'bad board' };
      if (typeof r.id !== 'string' || !/^[a-z0-9_.]{1,80}$/.test(r.id))
        return { ok: false, reason: 'bad request' };
      return { ok: true, command: { type: 'takeRequest', board: r.board, id: r.id } };
    case 'turnInRequest':
      if (typeof r.id !== 'string' || !/^[a-z0-9_.]{1,80}$/.test(r.id))
        return { ok: false, reason: 'bad request' };
      return { ok: true, command: { type: 'turnInRequest', id: r.id } };
    case 'pinRequest':
      if (r.id !== null && (typeof r.id !== 'string' || !/^[a-z0-9_.]{1,80}$/.test(r.id)))
        return { ok: false, reason: 'bad request' };
      return { ok: true, command: { type: 'pinRequest', id: r.id as string | null } };
    case 'wearPath':
      if (
        typeof r.path !== 'string' ||
        !/^path\.[a-z_]{1,24}$/.test(r.path) ||
        typeof r.on !== 'boolean'
      )
        return { ok: false, reason: 'bad path' };
      return { ok: true, command: { type: 'wearPath', path: r.path, on: r.on } };
    case 'showPath':
      if (r.path !== null && (typeof r.path !== 'string' || !/^path\.[a-z_]{1,24}$/.test(r.path)))
        return { ok: false, reason: 'bad path' };
      return { ok: true, command: { type: 'showPath', path: r.path as string | null } };
    case 'assign':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 1 || (r.slot as number) > 3)
        return { ok: false, reason: 'bad slot' };
      if (
        r.technique !== null &&
        (typeof r.technique !== 'string' || !/^technique\.[a-z0-9_]{1,40}$/.test(r.technique))
      )
        return { ok: false, reason: 'bad technique' };
      return {
        ok: true,
        command: {
          type: 'assign',
          slot: r.slot as number,
          technique: r.technique as string | null,
        },
      };
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
