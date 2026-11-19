/**
 * How the day looks (M4-09): grades per phase and weather as palette indices, point lights,
 * weather particles, and seasonal tile palettes. All data. The renderer reads it, nothing here
 * draws. Colors are palette indices (content/sprites/palette.ts), never literals.
 */
import type { DayPhase, Season, Weather } from '../balance/time';

/** A tint laid over the frame: a palette index, how strong, and how it combines. */
export interface Grade {
  color: number;
  alpha: number;
  /** `multiply` darkens toward the color. `normal` lays it on, for haze. */
  blend: 'multiply' | 'normal';
}

/** The day phase grades. Day is untouched. Phases blend into each other over `blendFraction` of the phase. */
export const PHASE_GRADE: Readonly<Record<DayPhase, Grade>> = {
  dawn: { color: 7, alpha: 0.35, blend: 'multiply' },
  day: { color: 3, alpha: 0, blend: 'multiply' },
  dusk: { color: 22, alpha: 0.45, blend: 'multiply' },
  night: { color: 12, alpha: 0.62, blend: 'multiply' },
};

/** The first share of a phase spent blending in from the one before. */
export const BLEND_FRACTION = 0.25;

/** The weather grade, laid over the phase grade. Clear is none. */
export const WEATHER_GRADE: Readonly<Record<Weather, Grade>> = {
  clear: { color: 3, alpha: 0, blend: 'normal' },
  rain: { color: 17, alpha: 0.22, blend: 'multiply' },
  storm: { color: 16, alpha: 0.38, blend: 'multiply' },
  fog: { color: 2, alpha: 0.34, blend: 'normal' },
  snow: { color: 3, alpha: 0.14, blend: 'normal' },
  heat: { color: 22, alpha: 0.1, blend: 'normal' },
  sandstorm: { color: 6, alpha: 0.3, blend: 'normal' },
};

/** A kind of falling or blowing particle. Speeds are logical px a second. */
export interface ParticleDef {
  /** Particles on screen at once. */
  count: number;
  /** Fall speed, and sideways drift (negative blows left). */
  fall: number;
  drift: number;
  /** Size in px: width and height of the mark. */
  w: number;
  h: number;
  color: number;
  alpha: number;
}

/** Weather particles. Kinds without an entry have none. */
export const WEATHER_PARTICLES: Readonly<Partial<Record<Weather, ParticleDef>>> = {
  rain: { count: 70, fall: 260, drift: -40, w: 1, h: 4, color: 14, alpha: 0.7 },
  storm: { count: 130, fall: 340, drift: -110, w: 1, h: 5, color: 15, alpha: 0.8 },
  snow: { count: 60, fall: 40, drift: -12, w: 2, h: 2, color: 3, alpha: 0.9 },
  sandstorm: { count: 90, fall: 6, drift: -220, w: 4, h: 1, color: 6, alpha: 0.6 },
};

/** Lightning during a storm: how often (mean seconds between), and the white-out's strength. */
export const STORM_FLASH = { meanSeconds: 9, alpha: 0.35, ms: 120 } as const;

/** A point light at night: radius in px, and the palette color it glows. */
export interface LightDef {
  radius: number;
  color: number;
  alpha: number;
}

/** Lights by what makes them. Tiles are matched by tile id, fixtures by type, the lantern by item. */
export const LIGHTS = {
  tiles: {
    'tile.torch': { radius: 44, color: 23, alpha: 0.75 },
    'tile.wall_window': { radius: 26, color: 47, alpha: 0.55 },
  } as Record<string, LightDef>,
  fixtures: {
    waystone: { radius: 60, color: 26, alpha: 0.7 },
    torch: { radius: 44, color: 23, alpha: 0.75 },
  } as Record<string, LightDef>,
  lantern: { radius: 56, color: 23, alpha: 0.8 } as LightDef,
} as const;

/**
 * How dark it must be for lights to show: the phase grade's alpha above this means the lights
 * are lit. Dawn and dusk show them faintly, in proportion.
 */
export const LIGHT_FROM_ALPHA = 0.2;

/**
 * Seasonal tile palettes (M6 and the region art read them): terrain ids by name map each palette
 * index to another for that season. Data only. An absent season or index is left as it is.
 */
export const SEASON_PALETTE: Readonly<Record<Season, Readonly<Record<number, number>>>> = {
  spring: {},
  summer: { 11: 10 },
  autumn: { 9: 21, 10: 22, 11: 23 },
  winter: { 9: 17, 10: 18, 11: 19 },
};

/** Crop calendar hooks (M6): which crops grow in which season. Data only. */
export const CROP_CALENDAR: Readonly<Record<Season, readonly string[]>> = {
  spring: ['crop.turnip', 'crop.pea'],
  summer: ['crop.corn', 'crop.tomato'],
  autumn: ['crop.pumpkin', 'crop.beet'],
  winter: ['crop.winter_kale'],
};
