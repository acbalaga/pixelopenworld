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
      reason: 'stamina' | 'focus' | 'cooldown' | 'requires' | 'skill' | 'locked';
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
  /** A creature died to `src`'s blow. `tag` is the weapon family or element, `kind` the creature. */
  | { type: 'killed'; src: number; dst: number; kind: string; tag: string }
  /** A creature of this kind came close to `who`, once per approach. Counts toward Mossfriend. */
  | { type: 'met'; who: number; id: number; kind: string }
  /** A fight ended that was won with nothing taken. Sent by the deed system. */
  | { type: 'untouchedFight'; who: number }
  | { type: 'pathEarned'; who: number; path: string }
  | { type: 'pathWorn'; who: number; path: string; on: boolean }
  | { type: 'gadgetUsed'; who: number; item: string; gadget: string }
  | { type: 'snareSprung'; id: number; foe: number }
  | { type: 'loadoutSwapped'; who: number; active: number; locked: boolean }
  | { type: 'died'; id: number; team: 0 | 1 }
  | { type: 'respawned'; id: number }
  | { type: 'echoDropped'; id: number; coin: number }
  | { type: 'echoLost'; id: number }
  | { type: 'echoRecovered'; id: number; coin: number }
  | { type: 'projectileLaunched'; id: number; owner: number }
  | { type: 'lockChanged'; id: number; target: number | null }
  | { type: 'noticed'; id: number; target: number }
  /** A territorial creature began its warning: pose, sound and a marker at the territory edge. */
  | { type: 'creatureWarn'; id: number; target: number }
  /** A creature acted on its temperament in front of `target`. The Bestiary stores the first (M4-05). */
  | { type: 'temperamentSeen'; id: number; target: number; kind: string; temperament: string }
  /** The avatar `who` fed `item` to creature `id`, which is now calm. */
  | { type: 'creatureFed'; who: number; id: number; kind: string; item: string }
  /** The avatar `who` made a friend of creature `id` of `kind` (fed, soothed). The Bestiary opens the entry. */
  | { type: 'befriended'; who: number; id: number; kind: string }
  | { type: 'leashReset'; id: number }
  /** A burrower went under, or rose to strike. */
  | { type: 'burrowed'; id: number }
  | { type: 'surfaced'; id: number }
  | { type: 'phaseChanged'; id: number; phase: number }
  | { type: 'spawned'; id: number; creature: string }
  /** A gathering node was worked. Sent by the gathering system, read by skills. */
  | { type: 'gathered'; id: number; tag: string; item: string; tier: number; qty: number }
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
  /** The Bag was full, so `qty` of `item` went to the storage chest. `free` is its empty slots now. */
  | { type: 'bagOverflow'; id: number; item: string; qty: number; free: number }
  | { type: 'equipped'; id: number; slot: string; item: string }
  | { type: 'unequipped'; id: number; slot: string; item: string }
  | { type: 'eaten'; id: number; item: string; raw?: boolean }
  /** A status was applied (or refreshed) on `id`. `src` is -1 for none. */
  /** The avatar slept on a bedroll. */
  | { type: 'slept'; id: number; who: number }
  /** The bedroll was used: the client opens the Rest panel. */
  | { type: 'bedOpened'; id: number; who: number }
  /** The avatar used a rest point in the wild (POW-M5-25): the camp panel opens. */
  | { type: 'campOpened'; id: number; who: number }
  /** The inn mirror was used: the client opens the look editor (M4-19). */
  | { type: 'mirrorOpened'; id: number; who: number }
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
  | { type: 'gateClosed'; id: number }
  /** The avatar read a sign (`kind` is the sign's fixture kind). */
  | { type: 'signRead'; who: number; id: number; kind: string }
  /** The avatar climbed a ledge (Fernside climb, the Bell Wall). */
  | { type: 'climbed'; who: number; id: number }
  | { type: 'plateChanged'; id: number; pressed: boolean }
  | { type: 'blockPushed'; id: number }
  | { type: 'blockReset'; id: number }
  /** A reset post was used. `count` is how many blocks went back (0 when nothing was out of place). */
  | { type: 'roomReset'; who: number; room: string; count: number }
  /** A block pressed a plate for the first time (M4-08). `id` is the plate. */
  | { type: 'blockSolved'; id: number; block: number }
  | { type: 'switchChanged'; id: number; on: boolean }
  | { type: 'wallBroken'; id: number; kind: string }
  | { type: 'torchLit'; id: number }
  | { type: 'arenaStarted'; id: number; wave: number }
  | { type: 'arenaCleared'; id: number }
  | { type: 'shortcutWrongSide'; id: number; who: number }
  /** The avatar fell through a drop. */
  | { type: 'fell'; who: number; amount: number }
  /** The avatar entered a dungeon room (any entry; XP pays the first). */
  | { type: 'delved'; who: number; dungeon: string; room: string }
  /** The dungeon's boss fell or was passed another way. */
  | { type: 'dungeonCleared'; who: number; dungeon: string }
  | { type: 'bossPhase'; id: number; boss: string; phase: number }
  | { type: 'bossObjective'; id: number; boss: string; step: string }
  | { type: 'bossResolved'; id: number; boss: string; how: 'fight' | 'objective' }
  | { type: 'chestOpened'; id: number; who: number }
  /** A letter arrived, or a letter's gift was claimed (M5-12). */
  | { type: 'mailArrived'; slot: number }
  | { type: 'mailClaimed'; id: number; who: number }
  /** A stack of crates slid aside for good (M5-29). */
  | { type: 'slideOpened'; id: number; who: number }
  | { type: 'tabletRead'; id: number; who: number }
  | { type: 'storageOpened'; id: number; who: number }
  | { type: 'boardOpened'; id: number; who: number; board: string }
  | { type: 'storageMoved'; who: number; item: string; qty: number; dir: 'in' | 'out' }
  | { type: 'waystoneSet'; id: number; who: number }
  /** The avatar uncovered `blocks` blocks of the map for the first time (M4-06). */
  | { type: 'revealed'; who: number; blocks: number }
  /** An item left the bag onto the ground at `x`, `y` (px). `pickup` is the entity it became (M4-20). */
  /** A thief took an item from a bag (m6), or it came back. */
  | { type: 'itemStolen'; who: number; creature: number; item: string }
  | { type: 'itemReturned'; who: number; item: string; how: 'fell' | 'bag' | 'dropped' }
  | { type: 'itemDropped'; who: number; item: string; qty: number; pickup: number }
  /** An item came into the bag from the world, from any source but the Singulars' own gifts (M4-20). */
  | { type: 'itemGained'; who: number; item: string; qty: number }
  /** The avatar bedded down outdoors. `wake` is the wake point it was at, or null. */
  | { type: 'sleptOutdoors'; who: number; wake: string | null }
  /** The avatar used a world fixture of a kind that only records the use (a mound of earth). */
  | { type: 'fixtureUsed'; id: number; who: number; kind: string }
  /** A dialogue set a flag. */
  | { type: 'flagSet'; who: number; flag: string }
  /** A Singular fired (`step` 0) or finished a step. Shown as a banner, never named before. */
  | { type: 'singularStep'; who: number; id: string; step: number }
  | { type: 'singularDone'; who: number; id: string }
  /** The avatar finished a Singular. M5 reads this to tell the world. */
  | { type: 'worldFirst'; who: number; id: string }
  /** A Waystone was touched for the first time (M4-07). */
  | { type: 'waystoneAttuned'; who: number; region: string; stone: string }
  /** The avatar travelled between Waystones. */
  | { type: 'traveled'; who: number; region: string; from: string | null; to: string }
  /** A rumor was told to the avatar (M4-06). */
  | { type: 'rumorHeard'; who: number; rumor: string }
  /** The avatar took a portal. Render fades and snaps the camera. */
  | { type: 'talkStarted'; who: number; npc: string }
  | { type: 'requestStarted'; who: number; request: string }
  | { type: 'shortcutOpened'; id: number }
  | {
      type: 'techniqueLearned';
      who: number;
      technique: string;
      via: 'insight' | 'manual' | 'taught' | 'request';
    }
  /** A skill's first XP, a manual or a lesson woke it (M4-15). */
  | { type: 'skillAwakened'; id: number; skill: string }
  /** A bag item was used and the Bag grew to `slots`. */
  | { type: 'bagGrew'; who: number; item: string; slots: number }
  /** A bag item was used but the Bag is already that big, so it was kept. */
  | { type: 'bagBigEnough'; who: number; item: string }
  /** A manual was read and used up. */
  /** The avatar stopped at a camp, outdoors. One notice. */
  | { type: 'campSettled'; who: number }
  /** A camp has paid all it will today. One notice. */
  | { type: 'campSpent'; who: number }
  | { type: 'manualRead'; who: number; item: string; technique: string }
  /** A manual was read whose technique is already known, so it was kept. */
  | { type: 'manualKnown'; who: number; item: string; technique: string }
  | { type: 'requestProgress'; who: number; request: string; progress: number }
  | { type: 'requestReady'; who: number; request: string }
  | { type: 'requestCompleted'; who: number; request: string }
  | { type: 'shopOpened'; who: number; shop: string }
  | { type: 'bought'; who: number; item: string; qty: number; coin: number }
  | { type: 'sold'; who: number; item: string; qty: number; coin: number; haggled: boolean }
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
  | { type: 'roomChanged'; who: number; from: string; to: string }
  // ---- Travelers (M5-03). `slot` is the Traveler's slot, 0 to 239. ----
  /** A Traveler came online at `place` (an index into the places list). */
  | { type: 'travelerLoggedIn'; slot: number; place: number }
  | { type: 'travelerLoggedOut'; slot: number; place: number }
  /** A Traveler finished a trip and stands at `place`. */
  | { type: 'travelerArrived'; slot: number; place: number }
  /** A drop at a low chance (or a rare find): chat may talk about it. */
  | {
      type: 'travelerLooted';
      slot: number;
      item: string;
      qty: number;
      creature: string;
      chance: number;
    }
  /** A skill crossed a rank: `points` is the new total. */
  | { type: 'travelerRankUp'; slot: number; skill: string; points: number }
  | { type: 'travelerDied'; slot: number; creature: string; place: number }
  | { type: 'travelerCrafted'; slot: number; item: string; qty: number; recipe: string }
  | { type: 'travelerSold'; slot: number; item: string; qty: number; price: number }
  /** A login catch-up finished. `away` is at most six things that changed (rank-ups, big purses). */
  | { type: 'travelersAway'; away: TravelerAway[] }
  /** The player used the context button on a promoted Traveler: the UI opens its profile card. */
  | { type: 'travelerInspect'; slot: number }
  // ---- Rankings (M5-09). ----
  /** The player newly passed a Traveler in the top of a board. `rank` is where the player now stands. */
  | { type: 'playerPassed'; board: string; slot: number; rank: number }
  // ---- Chat (M5-05). ----
  /** The fact a chat line came from, sent just before the line: an event of this tick or a state. */
  | { type: 'chatSource'; id: string; fact: string }
  /** A Traveler said something. `source` is the id of the `chatSource` or event it came from. */
  | {
      type: 'travelerSpoke';
      channel: 'world' | 'local' | 'whisper';
      slot: number;
      text: string;
      glyphs: string[];
      source: string;
      template: string;
      reply: boolean;
      /** The slot values the line was filled with, for the dev chat view and the tests. */
      slots: Record<string, string>;
      /** Reply chips the player may answer with (M5-06): 2 to 4, or none for a line nobody answers. */
      chips: { id: string; text: string }[];
    }
  /** The player said something with a chip (M5-06). `slot` is who they said it to. */
  | { type: 'playerSpoke'; channel: 'local' | 'whisper'; slot: number; text: string }
  /** A friendship changed (M5-06): a request was sent or declined, a friend added or removed. */
  | {
      type: 'friendChanged';
      slot: number;
      change: 'requested' | 'added' | 'declined' | 'removed';
    };

/** One thing the Travelers did while the player was away. */
export type TravelerAway =
  | { kind: 'rankUp'; slot: number; skill: string; rank: number }
  | { kind: 'coin'; slot: number; gain: number };

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
