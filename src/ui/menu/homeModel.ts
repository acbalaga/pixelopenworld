/**
 * What the player sees of the room they stand in (POW-M6-07): the pieces standing there and the
 * pieces in the bag that could be placed. Null outside one of the player's rooms.
 */
import { PIECE_BY_ID, PIECE_BY_ITEM } from '../../content/furniture/pieces';
import { ITEMS } from '../../content/items';
import { ITEM_STRINGS } from '../../content/strings/items';
import { FURNITURE_STRINGS as S } from '../../content/strings/furniture';
import { getComp } from '../../sim/kernel/entities';
import { firstSpot, interiorOf, placedIn } from '../../sim/home';
import type { SimState } from '../../sim/state';

export interface PlacedRow {
  i: number;
  name: string;
  icon: string;
  /** "Tile 2, 0" or "On the wall, tile 1". */
  where: string;
  wall: boolean;
}

export interface BagPieceRow {
  slot: number;
  name: string;
  icon: string;
  qty: number;
  /** The first spot it fits at rotation 0, or null if the room has none. */
  spot: { x: number; y: number } | null;
}

export interface HomeView {
  room: string;
  title: string;
  placed: PlacedRow[];
  bag: BagPieceRow[];
}

const nameOf = (item: string): string => ITEM_STRINGS[ITEMS[item]?.nameKey ?? ''] ?? item;

export function homeView(state: SimState, who: number): HomeView | null {
  const room = interiorOf(state, who);
  if (!room) return null;
  const list = placedIn(state, room.id);
  const placed: PlacedRow[] = list.map((o, i) => {
    const p = PIECE_BY_ID[o.piece];
    const wall = p?.layer === 'wall';
    return {
      i,
      name: nameOf(p?.item ?? o.piece),
      icon: ITEMS[p?.item ?? '']?.icon ?? '',
      where: (wall ? S.onWall : S.at)
        .replace('{x}', String(o.x + 1))
        .replace('{y}', String(o.y + 1)),
      wall,
    };
  });
  const bag: BagPieceRow[] = [];
  getComp(state.entities, who, 'inventory')?.slots.forEach((s, slot) => {
    const p = s ? PIECE_BY_ITEM[s.item] : undefined;
    if (!s || !p) return;
    bag.push({
      slot,
      name: nameOf(s.item),
      icon: ITEMS[s.item]?.icon ?? '',
      qty: s.qty,
      spot: firstSpot(room, p, list),
    });
  });
  return { room: room.id, title: S.rooms[room.id] ?? S.title, placed, bag };
}
