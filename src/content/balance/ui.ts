/** HUD and Menu tunables. Times are ms. Distances are CSS px. */
export const UI_BALANCE = {
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
