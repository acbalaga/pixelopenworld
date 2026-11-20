/**
 * Where each named place stands in Dawnmeadow (POW-M4-12), in region tiles. `rect` is the place;
 * `slots` are open tiles in it, nearest the front first, where people stand. Hearthford's rects are
 * its town parts (a test holds them to that); the rest follow the stamps in the region spec. Every
 * slot is open ground in the baked map (a test bakes it and checks). The Cairnmoor well and shelter
 * have none until the Hermit's Well is built (POW-M4-11 m9), so whoever keeps to them stays put.
 */
export interface PlaceSpot {
  rect: { x: number; y: number; w: number; h: number };
  slots: readonly (readonly [number, number])[];
}

export const PLACE_SPOTS: Readonly<Record<string, PlaceSpot>> = {
  'hearthford.square': {
    rect: { x: 180, y: 187, w: 24, h: 13 },
    slots: [
      [192, 193],
      [192, 195],
      [190, 193],
      [194, 193],
      [192, 191],
    ],
  },
  'hearthford.market_street': {
    rect: { x: 182, y: 207, w: 19, h: 4 },
    slots: [
      [191, 209],
      [193, 209],
      [191, 207],
      [193, 207],
      [189, 209],
    ],
  },
  'hearthford.brin_shop': {
    rect: { x: 182, y: 202, w: 8, h: 5 },
    slots: [
      [186, 208],
      [184, 208],
      [188, 208],
      [182, 208],
      [190, 208],
    ],
  },
  'hearthford.smithy': {
    rect: { x: 195, y: 169, w: 9, h: 5 },
    slots: [
      [199, 175],
      [201, 175],
      [197, 175],
      [203, 175],
      [195, 175],
    ],
  },
  'hearthford.carpentry': {
    rect: { x: 205, y: 169, w: 9, h: 5 },
    slots: [
      [209, 175],
      [211, 175],
      [207, 175],
      [213, 175],
      [205, 175],
    ],
  },
  'hearthford.tailor': {
    rect: { x: 195, y: 178, w: 9, h: 5 },
    slots: [
      [199, 184],
      [201, 184],
      [197, 184],
      [203, 184],
      [195, 184],
    ],
  },
  'hearthford.apothecary': {
    rect: { x: 205, y: 178, w: 9, h: 5 },
    slots: [
      [209, 184],
      [211, 184],
      [207, 184],
      [213, 184],
      [205, 184],
    ],
  },
  'hearthford.tinker_shed': {
    rect: { x: 182, y: 178, w: 8, h: 5 },
    slots: [
      [186, 184],
      [184, 184],
      [188, 184],
      [182, 184],
      [190, 184],
    ],
  },
  'hearthford.rune_house': {
    rect: { x: 167, y: 179, w: 12, h: 5 },
    slots: [
      [173, 185],
      [171, 185],
      [175, 185],
      [169, 185],
      [177, 185],
    ],
  },
  'hearthford.bell_tower': {
    rect: { x: 184, y: 166, w: 6, h: 10 },
    slots: [
      [187, 177],
      [185, 177],
      [189, 177],
      [190, 175],
      [183, 177],
    ],
  },
  'hearthford.guard_yard': {
    rect: { x: 166, y: 195, w: 13, h: 8 },
    slots: [
      [173, 199],
      [171, 199],
      [172, 197],
      [172, 201],
      [174, 197],
    ],
  },
  'hearthford.inn': {
    rect: { x: 167, y: 205, w: 15, h: 5 },
    slots: [
      [174, 211],
      [176, 210],
      [176, 212],
      [172, 210],
      [172, 212],
    ],
  },
  'millbrook.mill': {
    rect: { x: 274, y: 115, w: 10, h: 2 },
    slots: [
      [279, 116],
      [277, 116],
      [281, 116],
      [275, 116],
      [283, 116],
    ],
  },
  'millbrook.farm_one': {
    rect: { x: 290, y: 102, w: 8, h: 1 },
    slots: [
      [294, 102],
      [292, 102],
      [296, 102],
      [290, 102],
    ],
  },
  'millbrook.fields': {
    rect: { x: 289, y: 104, w: 9, h: 3 },
    slots: [
      [293, 105],
      [295, 105],
      [291, 105],
      [297, 105],
      [289, 105],
    ],
  },
  'reedmouth.jetty': {
    rect: { x: 307, y: 244, w: 3, h: 9 },
    slots: [
      [308, 248],
      [308, 250],
      [309, 246],
      [307, 246],
      [308, 252],
    ],
  },
  'reedmouth.hut': {
    rect: { x: 298, y: 243, w: 8, h: 1 },
    slots: [
      [302, 243],
      [300, 243],
      [304, 243],
      [298, 243],
    ],
  },
  'stonecrop.quarry': {
    rect: { x: 176, y: 44, w: 10, h: 4 },
    slots: [
      [181, 46],
      [181, 44],
      [179, 46],
      [183, 46],
      [179, 44],
    ],
  },
  'stonecrop.foreman_tent': {
    rect: { x: 166, y: 51, w: 5, h: 2 },
    slots: [
      [168, 52],
      [170, 52],
      [166, 52],
    ],
  },
  'wayside.chapel': {
    rect: { x: 173, y: 267, w: 7, h: 3 },
    slots: [
      [176, 269],
      [178, 269],
      [174, 269],
      [176, 267],
      [178, 267],
    ],
  },
  'cairnmoor.well': {
    rect: { x: 9, y: 85, w: 7, h: 3 },
    slots: [
      [12, 86],
      [14, 86],
      [10, 87],
      [15, 87],
    ],
  },
  'cairnmoor.shelter': {
    rect: { x: 2, y: 85, w: 7, h: 2 },
    slots: [
      [4, 86],
      [6, 86],
      [3, 87],
      [8, 87],
    ],
  },
};
