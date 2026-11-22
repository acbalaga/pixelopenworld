/** HUD and Menu tunables. Times are ms. Distances are CSS px. */
export const UI_BALANCE = {
  /**
   * What the quick slot will carry (G4 playtest): only a consumable that does something worth a
   * button. Foraged raw food and a burnt mess restore a token amount and stay in the Bag.
   * Stamina and Focus are in tenths, so 100 is ten points.
   */
  quick: { minHp: 10, minPool: 100 },
  hud: {
    /** Pool bars and the status row fade after this long unchanged (design/09). */
    idleMs: 4000,
    /** Opacity of a faded element. Never fully gone, so a glance still finds it. */
    fadedAlpha: 0.35,
    /** Time to fade down. */
    fadeOutMs: 600,
  },
  menu: {
    /** Hold this long to confirm a destructive action. */
    holdConfirmMs: 700,
    /** Swipe up from within this many px of the bottom edge opens the Menu. */
    edgePx: 28,
    /** A swipe must travel at least this far and finish within this time. */
    swipeMinPx: 64,
    swipeMaxMs: 700,
    /** A swipe is mostly vertical: sideways travel stays under this fraction of upward travel. */
    swipeMaxSideways: 0.6,
    /** The Menu redraws from the sim at most this often while open. */
    refreshMs: 200,
  },
  /**
   * Message lanes (design/09, D21). Times are ms. Sizes are CSS px, so they follow the clear text
   * rather than the logical pixel grid.
   */
  messages: {
    /** A notice shows this long, plus `noticePerCharMs` for every character past `noticeFreeChars`. */
    noticeBaseMs: 2600,
    noticePerCharMs: 40,
    noticeFreeChars: 32,
    noticeCapMs: 6000,
    /** Notices on screen at once. More wait their turn. */
    noticeMax: 2,
    /** The same key posted again within this long adds a count instead of a new message. */
    mergeMs: 1500,
    bannerMs: 3000,
    /** Banners that wait their turn. */
    bannerQueueMax: 8,
    /** Floaters stacked at once, how long each stays, the longest text, and the merge window. */
    floaterStack: 3,
    floaterMs: 1600,
    floaterChars: 24,
    floaterMergeMs: 1500,
    /** Chat lines in the lane, and how long a line stays in it. */
    chatLines: 2,
    chatShowMs: 14_000,
    /** The System log keeps everything since login, up to this many entries. */
    logMax: 2000,
    /** Layout, CSS px. */
    laneGap: 6,
    rowH: 40,
    bannerH: 48,
    /** Landscape lanes start under the clock row. */
    clockRowPx: 30,
    chatRowH: 18,
    laneMaxW: 320,
    chatLandscapeW: 220,
    /** Floater column: beside the avatar, from the head point down to the feet. */
    floaterW: 120,
    floaterRowH: 20,
    /** The chat sheet's share of the screen height. */
    sheetFraction: 0.5,
  },
  /** The name of a technique or boss move shouted over the head of whoever uses it (G4 playtest). */
  callout: {
    /** How long it shows, ms. */
    ms: 1000,
    /** Above the entity's center, logical px. */
    abovePx: 22,
    /** How far it drifts up while it shows, logical px. None under reduced motion. */
    risePx: 6,
  },
  /** The action meter over the avatar while it works (design/09). Distances are logical px. */
  meter: {
    /** Space between the top of the meter and the avatar's head point. */
    gapPx: 6,
    /** Sweep, rhythm and timing track, at least 72 x 7. */
    trackW: 80,
    trackH: 7,
    /** Trace and hold panel, at most this wide and tall. */
    panelMax: 120,
    /** A panel shrinks to fit between the status row and the thumb zone, down to this. */
    panelMin: 56,
    /** Space between the feet and a meter that flipped below the avatar. */
    flipMarginPx: 4,
    /** Room under the track or panel for pips and the time bar. */
    tailPx: 10,
    /** Head point above the feet: clears the sprite and the Path title. */
    headDy: 30,
    /** Fade out when the work ends. */
    fadeMs: 150,
    /** A spark on a hit. */
    sparkMs: 220,
  },
} as const;
