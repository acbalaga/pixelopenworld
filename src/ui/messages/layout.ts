import { UI_BALANCE } from '../../content/balance/ui';
import type { ControlLayout, Rect } from '../../platform/input/layout';
import { PORTRAIT_FOCUS_REGION } from '../../render/camera';
import type { ViewportInfo } from '../../render/viewport';

const B = UI_BALANCE.messages;

/** Where each lane sits, in CSS px. */
export interface LaneRects {
  banner: Rect;
  /** The whole notice stack: `noticeMax` rows, newest on top. */
  notices: Rect;
  chat: Rect;
  /** The column of floaters beside the avatar, from its head point down to its feet. */
  floaters: Rect;
  /** The action meter keeps below this y, so it never rises into the lanes. */
  meterTop: number;
}

/** What the lanes keep clear of, besides each other. */
export interface LaneInput {
  width: number;
  height: number;
  controls: ControlLayout;
  insets: { top: number; right: number; bottom: number; left: number };
  /** Bottom of the pool bars, status row and XP ticks, CSS px: the HUD block the lanes sit under. */
  hudBottom: number;
  /** CSS px per logical px. */
  k: number;
  /** The avatar on screen, CSS px: head point and feet. */
  avatar: { x: number; headY: number; feetY: number };
}

const union = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...rs.map((r) => r.x + r.w)) - x,
    h: Math.max(...rs.map((r) => r.y + r.h)) - y,
  };
};

/** True if two rects share any area. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Lane positions from the same layout the HUD uses (`computeLayout`). The banner and the notices
 * sit under the HUD block and clear of the menu, bag and swap buttons, centered in portrait and
 * at the left in landscape (the action meter is over the avatar at the middle). The chat lane is
 * in the bottom corner on the stick's side, above the swipe-up edge strip and clear of every
 * button (owner, 2026-11-27): drags on it pass through to the stick. The floaters are beside the
 * avatar. Pure.
 */
export function laneRects(i: LaneInput): LaneRects {
  const landscape = i.width > i.height;
  const top = union([i.controls.buttons.menu, i.controls.buttons.bag, i.controls.buttons.swap]);
  const left = i.insets.left + 8;
  const right = i.width - i.insets.right - 8;
  // Portrait: centered under the XP ticks. Landscape: under the clock row and left of the menu
  // buttons, because the action meter is over the avatar at the middle and the chat lane has the
  // left. (The menu buttons are at the top, so below them is free too.)
  const cluster = top.x > i.width / 2;
  const limit = landscape && cluster ? top.x - B.laneGap : right;
  const topY = landscape
    ? i.insets.top + B.clockRowPx
    : Math.max(i.hudBottom, top.y + top.h) + B.laneGap;
  const w = Math.min(landscape ? B.laneMaxW - 20 : B.laneMaxW, limit - left);
  const x = landscape ? limit - w : Math.round((i.width - w) / 2);
  // A banner and the notices never show together (notices wait while a banner shows), so the
  // banner takes the place of the stack.
  const stack: Rect = {
    x,
    y: topY,
    w,
    h: B.rowH * B.noticeMax + B.laneGap * (B.noticeMax - 1),
  };
  const zoneTop = i.controls.stickZone.y;
  const chatH = B.chatRowH * B.chatLines;
  const zone = i.controls.stickZone;
  const chatY = zone.y + zone.h - B.laneGap - chatH;
  const chatW = landscape
    ? B.chatLandscapeW
    : Math.min(B.laneMaxW, Math.round((right - left) * 0.62));
  // The stick's side is the side away from the action buttons (left unless left-handed).
  const pad = Object.values(i.controls.buttons).filter(
    (r): r is Rect => !!r && r.y + r.h > zoneTop,
  );
  const padMid = pad.length ? pad.reduce((a, r) => a + r.x + r.w / 2, 0) / pad.length : i.width;
  const onLeft = padMid >= i.width / 2;
  // As wide as it may be without reaching a button beside it.
  const band = (r: Rect): boolean => r.y < chatY + chatH && chatY < r.y + r.h;
  const room = onLeft
    ? Math.min(right, ...pad.filter(band).map((r) => r.x - B.laneGap)) - left
    : right - Math.max(left, ...pad.filter(band).map((r) => r.x + r.w + B.laneGap));
  const cw = Math.max(0, Math.min(chatW, room));
  const chat: Rect = { x: onLeft ? left : right - cw, y: chatY, w: cw, h: chatH };
  // Beside the avatar, rows ending at its feet or just above the thumb zone, whichever is higher.
  const floatH = B.floaterRowH * B.floaterStack;
  const floatBottom = Math.min(i.avatar.feetY, zoneTop - B.laneGap);
  // Clear of the action meter's track (the common sweep bar) on whichever side has the room.
  const clear = (UI_BALANCE.meter.trackW * i.k) / 2 + B.laneGap;
  const fx = landscape
    ? i.avatar.x - clear - B.floaterW
    : Math.min(i.avatar.x + clear, right - B.floaterW);
  const floaters: Rect = {
    x: Math.max(left, fx),
    y: floatBottom - floatH,
    w: B.floaterW,
    h: floatH,
  };
  const banner: Rect = { ...stack, h: B.bannerH };
  return { banner, notices: stack, chat, floaters, meterTop: stack.y + stack.h + B.laneGap };
}

/** Logical px of the HUD block under the pool bars: bars, status row and two XP ticks. */
const HUD_BLOCK_LOGICAL = 3 + 20 + 15 + 4 + 2 * 9;
/** Head point above the feet, logical px (the action meter anchors here too). */
const HEAD_DY = UI_BALANCE.meter.headDy;

/**
 * Where the avatar stands on screen, in logical px: centered across, and in the middle of the
 * upper region on portrait (the camera's focus), with the feet 14 px below the follow point.
 */
export function avatarOnScreen(
  width: number,
  height: number,
  portrait: boolean,
): { x: number; headY: number; feetY: number } {
  const focus = Math.floor(portrait ? (height * PORTRAIT_FOCUS_REGION) / 2 : height / 2);
  const feetY = focus + 14;
  return { x: Math.floor(width / 2), headY: feetY - HEAD_DY, feetY };
}

/** Lane rects for a viewport, with the avatar where the camera puts it. CSS px. */
export function lanesFor(
  v: Pick<ViewportInfo, 'width' | 'height' | 'cssWidth' | 'cssHeight' | 'portrait' | 'safe'>,
  controls: ControlLayout,
  insets: LaneInput['insets'],
): LaneRects {
  const k = v.cssWidth / v.width;
  const a = avatarOnScreen(v.width, v.height, v.portrait);
  return laneRects({
    width: v.cssWidth,
    height: v.cssHeight,
    controls,
    insets,
    k,
    hudBottom: Math.round((v.safe.y + HUD_BLOCK_LOGICAL) * k),
    avatar: {
      x: Math.round(a.x * k),
      headY: Math.round(a.headY * k),
      feetY: Math.round(a.feetY * k),
    },
  });
}
