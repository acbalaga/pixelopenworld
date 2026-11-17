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
} as const;
