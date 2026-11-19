/**
 * What the Map tab and the minimap show, as plain data (POW-M4-06). No DOM. The rules live here
 * so they are tested: a landmark appears only once its block is uncovered, a rumor mark sits off
 * its true spot by an amount Cartography shrinks and goes away when the real place is found, and
 * a wake point is never marked.
 */
import { MAP_BALANCE } from '../../content/balance/map';
import { MAP_STRINGS as S } from '../../content/strings/map';
import { RUMORS } from '../../content/world/rumors';
import { getComp, type EntityId } from '../../sim/kernel/entities';
import { SUBPX } from '../../sim/kernel/fixed';
import { pointsOf } from '../../sim/skills';
import type { SimState } from '../../sim/state';
import { NO_REGION } from '../../sim/systems/map';
import {
  BLOCKS_PER_CHUNK,
  blockOf,
  countRevealed,
  isRevealed,
  rumorMark,
} from '../../sim/world/fog';

/** A named spot in tiles. */
export interface Spot {
  id: string;
  x: number;
  y: number;
}

/** What the game knows about the region on screen, from its manifest. Wake points are not part of it. */
export interface MapContext {
  region: string;
  regionName: string;
  chunks: { w: number; h: number };
  landmarks: readonly Spot[];
  waystones: readonly Spot[];
}

export type PlaceKind = 'landmark' | 'waystone' | 'rumor';

export interface PlaceView {
  key: string;
  kind: PlaceKind;
  name: string;
  /** Where it is drawn, in world tiles. For a rumor this is the mark, not the true spot. */
  x: number;
  y: number;
}

export interface NoteView {
  id: number;
  x: number;
  y: number;
  text: string;
}

export interface MapView {
  region: string;
  regionName: string;
  /** The avatar's tile, or null if there is no avatar. */
  player: { x: number; y: number } | null;
  /** Percent of the region's ground uncovered, 0 to 100. */
  percent: number;
  /** Blocks uncovered, so a view can tell when the picture changed. */
  revealed: number;
  places: PlaceView[];
  notes: NoteView[];
  /** Cartography points, for the rumor precision line. */
  points: number;
}

const TILE = 16;

export function mapView(state: SimState, who: EntityId, ctx: MapContext): MapView {
  const fog = state.map.fog[ctx.region] ?? {};
  const pos = getComp(state.entities, who, 'pos');
  const points = pointsOf(state, who, 'skill.cartography');
  const seen = (x: number, y: number): boolean => isRevealed(fog, blockOf(x), blockOf(y));

  const places: PlaceView[] = [];
  for (const l of ctx.landmarks)
    if (seen(l.x, l.y) && l.id in S.landmarks)
      places.push({
        key: `landmark.${l.id}`,
        kind: 'landmark',
        name: S.landmarks[l.id as keyof typeof S.landmarks],
        x: l.x,
        y: l.y,
      });
  for (const w of ctx.waystones)
    if (seen(w.x, w.y) && w.id in S.waystones)
      places.push({
        key: `waystone.${w.id}`,
        kind: 'waystone',
        name: S.waystones[w.id as keyof typeof S.waystones],
        x: w.x,
        y: w.y,
      });
  for (const id of state.map.rumors) {
    const r = RUMORS[id];
    // Heard of in this region, and not found yet: once the real place is uncovered the mark goes.
    if (!r || r.region !== ctx.region || seen(r.x, r.y)) continue;
    const m = rumorMark(state.seed, id, r.x, r.y, points);
    places.push({
      key: id,
      kind: 'rumor',
      name: S.rumors[id as keyof typeof S.rumors] ?? id,
      x: m.x,
      y: m.y,
    });
  }

  const total = ctx.chunks.w * ctx.chunks.h * BLOCKS_PER_CHUNK * BLOCKS_PER_CHUNK;
  const n = countRevealed(fog);
  return {
    region: ctx.region,
    regionName: ctx.regionName,
    player: pos
      ? { x: Math.floor(pos.x / SUBPX / TILE), y: Math.floor((pos.y / SUBPX - 1) / TILE) }
      : null,
    percent:
      total === 0 ? 0 : Math.min(100, n === 0 ? 0 : Math.max(1, Math.floor((n * 100) / total))),
    revealed: n,
    places,
    notes: state.map.notes.map((x) => ({ ...x })),
    points,
  };
}

/** The region the sim is playing, for callers that have no manifest. */
export function regionOf(state: SimState): string {
  return state.region ?? NO_REGION;
}

/** True if another note fits. */
export function canAddNote(state: SimState): boolean {
  return state.map.notes.length < MAP_BALANCE.notes.max;
}
