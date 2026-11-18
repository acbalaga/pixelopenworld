# Owner playtest after M3

**When:** 2026-11-18, on the M3 preview build.
**Who:** the owner, on a phone.
**What happens to it:** every finding below became a design decision (master plan D16 to D22) and a ticket in M4. Nothing here is implemented by this document.

Each entry lists what the owner saw, what the code does today, the decision, and the ticket that delivers it.

## F1. The minigame is out of sight

**Seen.** While cooking or gathering, the timing bar sits low on the screen. The owner could not see it and could not tell the avatar was doing anything.

**Cause.** The gather sweep is a 40 px bar drawn at `safe.h - 40` (`src/demo/world.ts`, the gather block in the frame), which is inside the thumb zone and under the thumb. The craft step (`src/render/craftStep.ts`, `stepRect`) is centered on the screen, not on the avatar or the station. Neither moves with the work.

**Decision (D16).** Every timed step (gather sweep, craft step, fishing) is an **action meter** anchored in the world above the avatar's head, clamped to stay inside the upper world view. The avatar plays a work animation for the skill. The thing being worked shows a highlight. See design/09 "Action meter".

**Ticket.** POW-M4-13.

## F2. A new character knows too much

**Seen.** The first character already "knows" a lot of skills.

**Cause.** A band 0 technique without the `taught` flag is known the moment the game starts, at 0 points (`knows` in `src/sim/combat/techniques.ts`). That is Overhead, Aimed Shot, Palm, Bash, Light Feet, Hide and Hum of Courage before the player has touched a hammer, bow, shield or song. The Techniques list then shows them. On top of that, the demo scaffold still puts an iron sword, a leather outfit, a wooden shield and raw meat in every new bag (`src/demo/world.ts`, "Demo scaffolding, not the starter kit").

**Decision (D17).** Skills are **dormant** until first real use **awakens** them. A dormant skill shows nowhere. A band 0 technique has a **source**: innate to its weapon, taught by a person, read from a manual found in the world, or earned as **insight** after a set amount of practice. Nothing is known at creation except the basic swing of the weapon held. Existing characters keep everything they know (the migration grandfathers it). See design/03 "Awakening and sources".

**Ticket.** POW-M4-15.

## F3. The square holds everything

**Seen.** The first town lumps everything into one square. It does not look like a town.

**Cause.** The slice map places the Waystone, board, bed, storage, camp pot, anvil, workbench, loom, tinker bench, alchemy table, rune stone and eight people inside a roughly 20 by 15 tile square (`src/content/world/slice-map.ts`).

**Decision (D18).** Hubs are laid out as **districts** with streets between them: a square that holds only civic things (Waystone, board, notice wall), a craft row where each station lives in its workshop, an inn with the bed and the storage chest, a market street, homes, and a gate on each road. See design/02 "Hub layout" and the Hearthford plan in regions/01-dawnmeadow.

**Ticket.** POW-M4-04 (scope extended).

## F4. The start is too comfortable

**Seen.** A new character should start somewhere random outside the town, with one bread, a wooden dagger and ragged clothes.

**Cause.** The avatar appears at the Waystone in the square. The starter kit is a rusty sword and two bread, plus the demo scaffold in F2.

**Decision (D19).** A new character **wakes** at one of eight authored wake points around Hearthford, one to three minutes' walk out, picked by the character's own seed (and narrowed by the chosen origin, F8). The kit is exactly one bread, a wooden dagger (Blades) and ragged clothes (no defense). The wake point is the respawn point until a bed or Waystone is touched. The town is visible from every wake point (smoke, the mill, the Waystone light), so the first goal is found by sight. See design/01 "The first hour".

**Ticket.** POW-M4-14.

## F5. The cave is too easy

**Seen.** The cave layout should be a real challenge for the first levels.

**Cause.** Five rooms in a straight line (`src/content/world/rooms.ts`), one puzzle room, no route choice, no reason to manage resources.

**Decision.** The first cave becomes **the Rootway**, a mini-dungeon built on the M4-08 framework: a loop with a locked shortcut, two routes (one fights, one sneaks or climbs), one ambush room, a dark stretch that rewards a light, a miniboss with two phases, and one secret that cannot be reached on a first visit. Tuned so a fresh character with the bare kit can clear it in 10 to 15 minutes only after earning a few ranks and some crafted gear. See regions/01-dawnmeadow "The Rootway".

**Ticket.** POW-M4-21.

## F6. Every creature attacks on sight

**Seen.** Aggro should follow each creature's nature.

**Cause.** Every creature uses one rule: notice within `notice` px, then chase (`src/sim/systems/ai.ts`). There is no temperament.

**Decision (D20).** Every creature has a **temperament**: hostile, territorial, defensive, skittish, passive or curious, with optional pack and night behavior. Territorial creatures warn before they attack. See design/04 "Temperament". The existing roster is re-tagged in the same ticket.

**Ticket.** POW-M4-16.

## F7. The Menu, chat and toasts need a rework

**Seen.** The menu UI and UX, and how chat and toast messages are arranged, need a revamp.

**Cause.** Toasts, hints, chat ticker and skill ticks each pick their own spot. In the screenshots a hint sits over the clock and the debug panel, and toasts share the lower screen with the thumb zone. The Menu works but reads as a list of panels rather than a game system window.

**Decision (D21).** One **message layout** with fixed lanes, and a Menu revamp built on a small shared set of panel components. See design/09 "Message lanes" and "The Menu".

**Tickets.** POW-M4-17 (messages), POW-M4-18 (Menu).

## F8. Character creation needs more options

**Seen.** More options for character creation.

**Decision (D22).** Deeper looks (eyes, brows, face marks, more hair styles, height, accessories, a second cloth color) and a cosmetic **origin** that sets which wake points can be drawn and the first contextual line. Origin has no stat, item or XP effect. "Unremembered" (the default) draws from all eight wake points. See design/09 "Avatar setup".

**Ticket.** POW-M4-19.

## F9. Inspiration: place, progression and freedom

**Seen.** Take inspiration from Shangri-La Frontier and Overgeared for places, progression and gameplay freedom.

**Owner choice.** Two ideas, as principles only. No names, characters, plots, art or systems are copied.

1. **Unique scenarios.** Rare hidden questlines started by an odd action at an odd place, never posted on a board. Design term: **Singulars**. See design/03 "Singulars".
2. **Freedom of route.** No forced order. Every gate has more than one way past it, risk is the price of going early, and unusual builds find things others do not. See design/02 "Freedom of route".

**Tickets.** POW-M4-20 (Singulars framework and the first three), POW-M4-04 and POW-M4-11 (route rules applied to Dawnmeadow).

## Decisions the owner made in this review

| Question                   | Answer                                           |
| -------------------------- | ------------------------------------------------ |
| How are techniques gained? | Awaken by use, then teachers, manuals or insight |
| Which inspirations?        | Unique scenarios, freedom of route               |
| How far does creation go?  | Cosmetic plus an origin that is flavor only      |
| Where do these fixes go?   | Folded into M4, run first                        |
