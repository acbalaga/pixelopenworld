import type { SingularDef } from './types';

export type { SingularDef, SingularStep, SingularPred, SingularEffect } from './types';

/** Flags the Cold Oven sets, read by Tobin's dialogue (never by a UI string). */
export const COLD_OVEN_FLAGS = {
  bricks: 'singular.cold_oven.bricks',
  set: 'singular.cold_oven.set',
} as const;

const SCARECROW = { fixture: 'fixture.scarecrow', px: 48 } as const;

/**
 * Dawnmeadow's three Singulars (regions/01-dawnmeadow section 11). None is posted, hinted or
 * marked. Each starts from an odd action and never expires: time predicates are phases, which
 * come round every in-game day.
 */
export const SINGULARS: Readonly<Record<string, SingularDef>> = Object.fromEntries(
  (
    [
      {
        id: 'singular.crows_due',
        region: 'dawnmeadow',
        estMinutes: 30,
        // A shiny thing left for the crow on the scarecrow at Millbrook, on three different days.
        trigger: {
          id: 'trigger',
          on: 'itemDropped',
          when: [{ itemTag: 'shiny' }, { near: SCARECROW }],
          count: { n: 3, by: 'day' },
        },
        steps: [
          // Seven different shiny things, one a day.
          {
            id: 'gifts',
            on: 'itemDropped',
            when: [{ itemTag: 'shiny' }, { near: SCARECROW }],
            count: { n: 7, by: 'item', oncePerDay: true },
          },
          // Follow it at dusk and dig where it lands. Digging needs Survival.
          {
            id: 'dig',
            on: 'fixtureUsed',
            subject: 'fixture.crow_mound',
            when: [{ phase: ['dusk'] }, { skill: { id: 'skill.survival', atLeast: 1 } }],
            then: [{ give: 'item.manual_hex', qty: 1 }],
          },
          // Read the book that was found.
          { id: 'read', on: 'manualRead', subject: 'item.manual_hex' },
        ],
        reward: [{ give: 'item.crow_feather_charm', qty: 1 }],
      },
      {
        id: 'singular.eight_beds',
        region: 'dawnmeadow',
        estMinutes: 30,
        // Bed down outdoors at three different wake points, a night each.
        trigger: {
          id: 'trigger',
          on: 'slept',
          when: [{ wake: true }, { phase: ['dusk', 'night'] }],
          count: { n: 3, by: 'place', oncePerDay: true },
        },
        steps: [
          // All eight, one per night. The first three count again: the trigger told nothing.
          {
            id: 'beds',
            on: 'slept',
            when: [{ wake: true }, { phase: ['dusk', 'night'] }],
            count: { n: 8, by: 'place', oncePerDay: true },
            inherit: true,
          },
        ],
        // A bundle is left beside you at the last.
        reward: [{ give: 'item.wayfarers_cloak', qty: 1 }],
      },
      {
        id: 'singular.cold_oven',
        region: 'dawnmeadow',
        estMinutes: 30,
        // The old cook pot in the empty house on the market street, at dawn, three times.
        trigger: {
          id: 'trigger',
          on: 'stationUsed',
          subject: 'camp_pot',
          when: [{ area: 'area.empty_house' }, { phase: ['dawn'] }],
          count: { n: 3, by: 'day' },
        },
        steps: [
          // Find the baker's firebricks. Three places hold one set (Rootway R9, the Deeps, the Undermill).
          {
            id: 'bricks',
            on: 'itemGained',
            subject: 'item.firebrick',
            then: [{ setFlag: COLD_OVEN_FLAGS.bricks }],
          },
          // Have Tobin set them (his dialogue sets this flag, Smithing 10).
          { id: 'set', on: 'flagSet', subject: COLD_OVEN_FLAGS.set },
          // Bake at dawn in the empty house.
          {
            id: 'bake',
            on: 'stationUsed',
            subject: 'camp_pot',
            when: [{ area: 'area.empty_house' }, { phase: ['dawn'] }],
          },
        ],
        reward: [{ give: 'item.bakers_peel', qty: 1 }, { learnRecipe: 'recipe.bakers_loaf' }],
      },
    ] satisfies SingularDef[]
  ).map((d) => [d.id, d]),
);
