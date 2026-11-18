/** Per-tick event queue. Render, audio, UI and chat read events. They never poll state. */

/** All sim events. Extend this union as systems appear. */
export type SimEvent =
  | { type: 'bounce'; id: number; axis: 'x' | 'y' }
  | { type: 'attackStarted'; id: number; attack: string }
  | {
      type: 'damageDealt';
      src: number;
      dst: number;
      amount: number;
      crit: boolean;
      /** The target was already staggered, so bonus damage applied. */
      bonus: boolean;
      heavy: boolean;
      /** What dealt it: the weapon family of a swing, or the element of a bolt. Pays skill XP. */
      tag: string;
      /** The element the hit carried, and whether it applies the paired status (M3-09). */
      elem?: string;
      applies?: boolean;
    }
  | { type: 'dodgeStarted'; id: number }
  /** An attack found the target inside its invulnerable frames. */
  | { type: 'dodged'; src: number; dst: number }
  | { type: 'perfectDodge'; id: number; src: number }
  | { type: 'staggerBreak'; id: number }
  /** A hit landed on a raised guard from the front. `who` blocked it, `src` swung. `amount` is what got through. */
  | { type: 'blocked'; who: number; src: number; amount: number }
  /** A guard raised just before the impact turned the hit aside. `who` parried `src`. */
  | { type: 'parried'; who: number; src: number }
  /** The guard dropped: out of Stamina, or the hit was a guard break. */
  | { type: 'guardBroken'; who: number }
  | {
      type: 'denied';
      id: number;
      reason: 'stamina' | 'focus' | 'cooldown' | 'requires' | 'locked';
    }
  | { type: 'techniqueUsed'; who: number; technique: string }
  | { type: 'channelStarted'; who: number; technique: string; ticks: number }
  | { type: 'channelCancelled'; who: number; technique: string }
  /** A song finished. Pays Performance XP. */
  | { type: 'perform'; who: number; technique: string }
  /** A creature that would have noticed a hidden unit did not. Pays Stealth XP. */
  | { type: 'sneak'; who: number; creature: number }
  /** Health restored by a technique. `src` is who cast it. */
  | { type: 'healed'; id: number; src: number; amount: number; tag: string }
  | { type: 'loadoutSwapped'; who: number; active: number; locked: boolean }
  | { type: 'died'; id: number; team: 0 | 1 }
  | { type: 'respawned'; id: number }
  | { type: 'echoDropped'; id: number; coin: number }
  | { type: 'echoLost'; id: number }
  | { type: 'echoRecovered'; id: number; coin: number }
  | { type: 'projectileLaunched'; id: number; owner: number }
  | { type: 'lockChanged'; id: number; target: number | null }
  | { type: 'noticed'; id: number; target: number }
  | { type: 'leashReset'; id: number }
  | { type: 'phaseChanged'; id: number; phase: number }
  | { type: 'spawned'; id: number; creature: string }
  /** A gathering node was worked. Sent by the gathering system, read by skills. */
  | { type: 'gathered'; id: number; tag: string; item: string; tier: number }
  /** A dish or item was made. Sent by the crafting system, read by skills. */
  /**
   * A craft finished. `tag` is the craft (the skill tag), `quality` 0 to 3. Sent by crafting,
   * read by skills, Trials and hints.
   */
  | {
      type: 'crafted';
      id: number;
      tag: string;
      recipe: string;
      tier: number;
      item: string;
      qty: number;
      quality: number;
      source: 'manual' | 'routine';
    }
  /** The avatar used a crafting station: the client opens its panel. */
  | { type: 'stationOpened'; id: number; who: number; station: string }
  | { type: 'craftStarted'; id: number; station: string; recipe: string }
  | { type: 'craftTap'; id: number; n: number }
  | { type: 'repaired'; id: number; item: string; tier: number }
  | { type: 'skillXp'; id: number; skill: string; amount: number }
  | { type: 'skillRankUp'; id: number; skill: string; points: number; mastery: string | null }
  /** XP has filled the bar but the next point waits on a Trial. */
  | { type: 'skillBanked'; id: number; skill: string }
  | { type: 'trialOffered'; id: number; trial: string }
  | { type: 'trialPassed'; id: number; trial: string }
  | { type: 'lootDropped'; id: number; item: string; qty: number }
  | { type: 'itemPickedUp'; id: number; item: string; qty: number }
  | { type: 'bagFull'; id: number; item: string }
  | { type: 'equipped'; id: number; slot: string; item: string }
  | { type: 'unequipped'; id: number; slot: string; item: string }
  | { type: 'eaten'; id: number; item: string }
  /** A status was applied (or refreshed) on `id`. `src` is -1 for none. */
  /** The avatar slept on a bedroll. */
  | { type: 'slept'; id: number; who: number }
  | { type: 'statusApplied'; id: number; status: string; src: number; refreshed: boolean }
  | { type: 'statusEnded'; id: number; status: string; how: 'expired' | 'cleared' }
  /** An element met a status: the reaction fired at `id`. */
  | { type: 'reaction'; id: number; reaction: string; src: number }
  /** An element hit a fixture and it changed. `action` is one of the fixture actions. */
  | { type: 'elementWorld'; id: number; element: string; action: string }
  | { type: 'fedStarted'; id: number; item: string; replaced: string | null }
  | { type: 'fedEnded'; id: number; item: string }
  | { type: 'gatherStarted'; id: number; node: number }
  | { type: 'gatherCancelled'; id: number; node: number }
  /** One sweep of a node that takes several is done. */
  | { type: 'gatherSwing'; id: number; node: number; sweet: boolean }
  /** A fish took the bait: the window to tap opens. */
  | { type: 'gatherBite'; id: number; node: number }
  | {
      type: 'gatherResolved';
      id: number;
      node: number;
      sweet: boolean;
      item: string;
      qty: number;
    }
  | { type: 'nodeReady'; id: number }
  | { type: 'recipeDiscovered'; id: number; recipe: string }
  | { type: 'craftFailed'; id: number }
  | { type: 'doorOpened'; id: number; who: number }
  | { type: 'doorLocked'; id: number; who: number; key: string }
  | { type: 'gateOpened'; id: number }
  | { type: 'plateChanged'; id: number; pressed: boolean }
  | { type: 'blockPushed'; id: number }
  | { type: 'blockReset'; id: number }
  | { type: 'chestOpened'; id: number; who: number }
  | { type: 'tabletRead'; id: number; who: number }
  | { type: 'storageOpened'; id: number; who: number }
  | { type: 'storageMoved'; who: number; item: string; qty: number; dir: 'in' | 'out' }
  | { type: 'waystoneSet'; id: number; who: number }
  /** The avatar took a portal. Render fades and snaps the camera. */
  | { type: 'talkStarted'; who: number; npc: string }
  | { type: 'requestStarted'; who: number; request: string }
  | { type: 'shortcutOpened'; id: number }
  | { type: 'techniqueLearned'; who: number; technique: string }
  | { type: 'requestProgress'; who: number; request: string; progress: number }
  | { type: 'requestReady'; who: number; request: string }
  | { type: 'requestCompleted'; who: number; request: string }
  | { type: 'shopOpened'; who: number; shop: string }
  | { type: 'bought'; who: number; item: string; qty: number; coin: number }
  | { type: 'sold'; who: number; item: string; qty: number; coin: number }
  | {
      type: 'shopDenied';
      who: number;
      reason: 'coin' | 'bag' | 'stock' | 'worthless' | 'range' | 'purse' | 'locked' | 'nothing';
    }
  | { type: 'boughtBack'; who: number; item: string; qty: number; coin: number }
  | { type: 'mended'; who: number; item: string; coin: number }
  /** One exchange of a haggle. `result` is the shopkeeper's answer; `price` is what stands. */
  | {
      type: 'haggleStep';
      who: number;
      shop: string;
      item: string;
      price: number;
      round: number;
      result: 'open' | 'accept' | 'counter' | 'refuse';
    }
  | {
      type: 'haggleEnded';
      who: number;
      shop: string;
      item: string;
      price: number;
      won: boolean;
      /** The shopkeeper ended it: the price stands and the item is closed until dawn. */
      refused: boolean;
    }
  /** A haggle closed at a better price than the opening one. Pays Bartering XP. */
  | { type: 'haggleWon'; who: number; shop: string; item: string; price: number }
  | { type: 'hintShown'; who: number; hint: string }
  | { type: 'hintEnded'; who: number; hint: string; how: 'done' | 'expired' }
  | { type: 'roomChanged'; who: number; from: string; to: string };

/** Transient queue. Cleared at the start of every tick. Not saved or hashed. */
export interface EventQueue {
  list: SimEvent[];
}

/** Creates an empty queue. */
export function createEventQueue(): EventQueue {
  return { list: [] };
}

/** Appends an event. */
export function emit(q: EventQueue, e: SimEvent): void {
  q.list.push(e);
}

/** Empties the queue. */
export function clearEvents(q: EventQueue): void {
  q.list.length = 0;
}
