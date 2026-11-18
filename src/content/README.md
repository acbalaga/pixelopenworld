# src/content

DATA. Typed content and every balance number, validated at build time. No logic that belongs in systems. All player-facing text lives in `strings/`.

## Regions and supply (M3-12)

`world/regions.ts` says which region each gathering node, creature spawner and loot chest belongs to. The slice is Dawnmeadow's first map and supplies exactly what it places. Whisperwood (tier 2, no map yet) holds the tier 2 materials, creatures and finds, so the first map prepares a character for the outside instead of holding everything. `npm run validate` fails if something belongs to no region, if a built region's supply is not what its map places, or if a tier 1 or 2 item cannot be obtained, counting recipes only when their ingredients can be obtained too (`tools/bake-assets/reachabilityAllow.ts` is empty and exists to stay that way).
