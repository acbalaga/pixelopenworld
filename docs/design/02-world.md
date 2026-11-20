# 02 World

## Structure

The world is one continuous map with no loading screens between outdoor areas. Three layers:

1. **The Continent.** Handcrafted. Eight regions around a central highland. All 100% content lives here and in the Undercroft.
2. **The Undercroft.** Handcrafted underground network beneath the Continent. Connects regions, holds the deepest dungeons and most of the hidden layer.
3. **The Unwritten.** Procedural and endless. Begins past the edge of the Continent. Not counted toward 100%.

## Units

| Thing     | Value                                                                            |
| --------- | -------------------------------------------------------------------------------- |
| Tile      | 16 x 16 px                                                                       |
| Chunk     | 32 x 32 tiles                                                                    |
| Region    | 12 x 12 chunks typical (384 x 384 tiles). About 4 to 5 minutes to cross on foot. |
| Continent | About 40 x 40 chunks including sea and mountains                                 |
| View      | About 11 to 14 tiles wide in portrait (see 09-ui-ux)                             |

## Regions

Tier sets creature strength, material tier, and gear tier. Tiers are fixed (decision A3).

| #   | Region       | Tier | Biome                            | Hub                        | Identity and signature activity                                           |
| --- | ------------ | ---- | -------------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| 1   | Dawnmeadow   | 1    | Farmland, gentle hills, river    | Hearthford (town)          | Home. Farming, cooking, first everything.                                 |
| 2   | Whisperwood  | 2    | Old forest, fog, giant roots     | Mossgate (tree village)    | Foraging, taming, archery. Easy to get lost in.                           |
| 3   | Saltreach    | 3    | Coast, cliffs, islands           | Port Brine (harbor city)   | Fishing, sailing between islands, the main market.                        |
| 4   | Ironvale     | 4    | Foothills, mines, quarries       | Anvil Rest (mining town)   | Mining, smithing, tinkering. First guild halls.                           |
| 5   | Sunken Mire  | 5    | Swamp, drowned ruins             | Stiltwater (stilt village) | Alchemy, hexing, stealth. Ruins start to look wrong.                      |
| 6   | Frostspine   | 6    | Alpine, snow, ice caves          | Highhearth (monastery)     | Survival, athletics, climbing. Weather can kill.                          |
| 7   | Glass Desert | 7    | Dunes, glass flats, buried city  | Mirage (caravan city)      | Deciphering, enchanting. The hidden layer is closest to the surface here. |
| 8   | The Crown    | 8    | Central highland, floating stone | None (a ruined capital)    | Endgame. No hub by design.                                                |

Each region contains, as a budget (see 10-content-budget for totals):

- 1 hub, 3 smaller settlements or camps
- 4 dungeons (15 to 40 minutes each), one of them the regional pass dungeon with the regional boss
- 12 mini-dungeons (caves, cellars, towers, 5 to 10 minutes)
- 30 points of interest (shrines, vistas, wrecks, hermits, puzzles)
- 6 Waystones
- 1 roaming field boss

## Hub layout

A hub is a town, not a square with everything in it (D18). Every hub is authored as districts joined by streets, so the player learns where things are by walking, and so a town reads as a place from the first screenshot.

| District      | Holds                                                                                                                                             | Rule                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Square        | Waystone, request board, guild notice wall, a fountain or well, benches                                                                           | Civic things only. No crafting stations, no beds, no shop counters.                |
| Craft row     | One workshop per craft family: smithy (anvil, forge), carpentry (workbench), tailor (loom), apothecary (alchemy table), tinker's shed, rune house | Each station sits inside or in front of its workshop, with the person who runs it. |
| Inn           | Bed, storage chest, cook pot, the innkeeper                                                                                                       | Where the player sleeps, stores and cooks by default.                              |
| Market street | Shop counters, the market terminal (M5), stalls that change by day                                                                                | Shopkeepers stand behind their counters.                                           |
| Homes         | NPC homes, later the player's plot (M6)                                                                                                           | People go home at night. Doors are real.                                           |
| Gates         | One per road, with a guard or a sign                                                                                                              | A gate is where the wild starts. Hostile spawns never sit inside the walls.        |

Distances: the square to any district is under 15 seconds on foot. The whole hub fits in about 3 x 3 chunks. Streets are at least 3 tiles wide so a thumb-steered walk does not snag. Each district has one landmark prop (the smithy chimney, the inn sign, the market awning) that reads at the minimap scale.

## Freedom of route

The second inspiration principle (D23): the player decides the order. The map is the difficulty curve, not a gatekeeper.

- **Every gate has more than one way past it.** A regional pass boss guards the easy road. Each region also has at least two harder ways out that skip it: a climb (Athletics), a hidden passage (Delving or Deciphering), a river or a pass that weather opens, a creature who carries you (Taming). They cost more time, more risk, or more skill. They never cost a key the player could not have.
- **Early is allowed, and it hurts.** Nothing stops a fresh character walking into tier 3 land. Creatures there notice farther and hit harder, so the price is paid in deaths and Echoes, not in walls.
- **Things above tier are visible from the start.** Each region places at least three sights the player cannot yet reach or survive: a ruin across a gorge, a named creature's den, a lit window on a cliff. They are reasons to come back, not markers.
- **Unusual builds find unusual things.** At least a fifth of each region's secrets are reached by a skill that is not combat (a song that opens a door, a dish that calms a guardian, a map that reveals a path). A player with an odd mix of skills should find something a fighter would walk past.
- **No route is the right one.** Requests, Trials and Singulars never say "first go to X". A request may name a place; it never orders the player's day.

## Travel

- **On foot** by default. Stamina sprint.
- **Waystones.** Touch to attune. Fast travel between attuned stones costs nothing. In-fiction they are the game's teleport gates. Six per region so no walk is longer than about two minutes.
- **Mounts** (M6). Tamed, faster, some cross shallow water or sand.
- **Boats** (M8). Saltreach onward. Open sea is navigable. Islands hold secrets.
- **Climbing and swimming** are Athletics-gated. Low skill means slow and stamina-hungry, not forbidden. Cliffs marked as sheer are true walls.

No invisible walls on land. Boundaries are sea, sheer cliffs, or tier (it is survivable to walk into Frostspine early, barely, and worth it).

## Time, seasons, weather

- One in-game day is 48 real minutes: day 30, dusk 4, night 10, dawn 4.
- Seven days per season, four seasons per year.
- The clock runs while the game is closed (it is a "server"). On login the world is at the correct time and date.
- Weather is per region, seeded per day: clear, rain, storm, fog, snow, heat, sandstorm. Weather changes spawns, fishing tables, crop growth, visibility, and fire or water magic strength.
- Night changes creature rosters and which Travelers are online.
- Each season has one festival in one hub (M6).

## Dungeons

Handcrafted room graphs. Each room is one chunk or smaller and fits the portrait view without much scrolling.

Building blocks (framework in POW-M4-08): locked doors and keys, switches and pressure plates, pushable blocks, light and dark rooms, timed gates, breakable walls, one-way drops, element puzzles (burn, freeze, grow, conduct), combat arenas, a mid-point shortcut back to the entrance, a boss room.

Rules:

- The first cave of every region is a real test for a character who has spent the first hour there (rank 5 to 10 in a weapon, crafted tier 1 gear). It is not a corridor. It has a loop, a choice of route and one room that punishes running in.
- Every dungeon teaches one idea, twists it, then tests it at the boss.
- Every dungeon has one secret that cannot be reached on a first visit with tier-appropriate skills. Reasons to return.
- Leaving and re-entering keeps solved puzzles solved. Enemies respawn daily.
- No dungeon requires a combat build. Each has at least one alternate route using a non-combat skill (Stealth, Athletics, Tinkering, Deciphering, Taming). The alternate route skips fights, not the boss. Bosses that guard regional passes have a non-combat resolution as well (see 04-combat).

## Secrets and discovery

- **Fog of war.** The map draws itself as you walk. Cartography skill widens reveal radius and adds annotations.
- **No objective markers** for anything the player has not personally found or been told about by a specific NPC or Traveler. Told locations appear as hand-drawn rumor marks with deliberate imprecision.
- **Landmarks** are tall and visible from far away so navigation works by sight.
- Every chunk on the Continent has at least one thing worth finding: a POI, a node cluster (two or more gathering nodes), a secret, a vista or a settlement. The bake enforces this (POW-M4-11).
- **Singulars** (design/03) start from places and actions, never from boards. A region holds a few. They are the rarest thing on its map.

## Authoring model

Agents cannot hand-paint maps. Regions are built from:

1. **Region spec** (data): biome masks, elevation bands, road graph, river paths, settlement and POI coordinates, spawn tables per zone.
2. **Stamps** (data): hand-authored ASCII tile layouts for everything a player looks at closely. Buildings, dungeon rooms, puzzle rooms, set pieces, town squares.
3. **Fill rules:** seeded generators that turn masks into natural terrain between stamps (tree scatter, grass variation, cliffs via autotile).
4. **Bake:** deterministic build step that outputs chunk files. Same inputs, same bytes. Output is committed so a diff shows exactly what changed.

A dev-only in-browser map viewer and stamp editor (POW-M4-10) lets the owner inspect and tweak.

## The Unwritten (frontier)

- Opens when the player first crosses a continental edge. Edges are reachable from the tier 5 regions onward, so players reach it at around 40 to 60 hours.
- Infinite in every outward direction. Generated per chunk from the world seed. Difficulty tier rises with distance, beyond tier 8.
- Biomes are remixes of continental biomes plus frontier-only ones.
- Contains procedural camps, ruins, mini-dungeons, field bosses, and rare "Drafts": landmarks that look half-finished (missing textures as plain colored tiles, repeated props, geometry that stops). These are intentional and tied to the lore.
- The player can plant Waystones here (limited, craftable) and build outposts.
- Travelers appear here rarely. The few that do are worth noticing.
- Chunks the player has changed are saved as deltas. Untouched chunks are regenerated from the seed.
