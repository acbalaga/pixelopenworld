import { UI_BALANCE } from '../../content/balance/ui';

/** A pointer sample in CSS px with its time in ms. */
export interface SwipePoint {
  x: number;
  y: number;
  t: number;
}

export type SwipeKind = 'edge-up' | 'down' | null;

/**
 * Classifies one finished pointer path. `edge-up` is a mostly vertical swipe up that began in the
 * bottom edge strip (opens the Menu). `down` is a mostly vertical swipe down from anywhere (the
 * caller decides where it counts, for example the Menu's grip). Pure.
 */
export function classifySwipe(
  start: SwipePoint,
  end: SwipePoint,
  screenHeight: number,
  bottomInset = 0,
): SwipeKind {
  const M = UI_BALANCE.menu;
  const dy = end.y - start.y;
  const dx = Math.abs(end.x - start.x);
  if (end.t - start.t > M.swipeMaxMs) return null;
  if (Math.abs(dy) < M.swipeMinPx || dx > Math.abs(dy) * M.swipeMaxSideways) return null;
  if (dy < 0 && start.y >= screenHeight - M.edgePx - bottomInset) return 'edge-up';
  if (dy > 0) return 'down';
  return null;
}

/**
 * Watches pointers on the window and reports swipes. `downZone` says whether a swipe down that
 * began at a given element counts (only the Menu's grip does, so a list can still scroll).
 */
export function attachSwipe(opts: {
  height: () => number;
  bottomInset: () => number;
  onEdgeUp: () => void;
  onDown: () => void;
  downZone: (target: EventTarget | null) => boolean;
}): () => void {
  const starts = new Map<number, SwipePoint & { target: EventTarget | null }>();
  const ac = new AbortController();
  const o = { signal: ac.signal, capture: true } as const;
  window.addEventListener(
    'pointerdown',
    (e) =>
      starts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, target: e.target }),
    o,
  );
  window.addEventListener('pointercancel', (e) => starts.delete(e.pointerId), o);
  window.addEventListener(
    'pointerup',
    (e) => {
      const s = starts.get(e.pointerId);
      starts.delete(e.pointerId);
      if (!s) return;
      const kind = classifySwipe(
        s,
        { x: e.clientX, y: e.clientY, t: e.timeStamp },
        opts.height(),
        opts.bottomInset(),
      );
      if (kind === 'edge-up') opts.onEdgeUp();
      else if (kind === 'down' && opts.downZone(s.target)) opts.onDown();
    },
    o,
  );
  return () => ac.abort();
}
