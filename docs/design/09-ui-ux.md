# 09 UI and UX

## Screen model

Portrait first. The game renders to a low-resolution logical canvas and scales by an integer factor so pixels stay square and sharp.

- Logical width: 180 to 239 px. Scale = the largest integer that keeps logical width at or above 180.
- Logical height: whatever the device gives at that scale (tall phones see more world).
- The canvas uses `image-rendering: pixelated`. Device safe areas (notch, home bar) are respected and never hold controls.

### Portrait layout

```
+--------------------------+
| pools  [notice lane] map |   pools and statuses, clock and weather, minimap toggle
| ticks    (banners)       |   skill ticks under pools, banners and notices under the clock
|                          |
|      [action meter]      |   above the avatar while it works (gather, craft, fish)
|        WORLD VIEW        |   top ~62% of height
|                          |
| chat (2 lines)     [log] |   chat lane, left, above the thumb zone
+--------------------------+
|   [t1][t2]               |
|        [t3][t4]  [ctx]   |   thumb zone, bottom ~38%
|   ( floating stick )     |   world continues underneath, dimmed controls
|  [menu]          [bag]   |
+--------------------------+
```

The world renders full-screen behind the thumb zone. The camera is offset so the avatar sits in the center of the upper region and is never under the thumb.

### Landscape and desktop

World full screen, Classic controls on the sides, chat bottom-left, minimap top-right. Desktop adds keyboard, mouse, and gamepad. Menus open as a centered panel.

## The text rule

This is how "pixel where it reads, something else where it does not" is enforced.

Two text renderers:

| Renderer       | Used for                                                                                                                                                  | How                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Pixel text** | HUD numbers, button labels, names over heads, damage numbers, short labels up to about 24 characters                                                      | Bitmap font on the canvas. Two sizes: 5x7 and 7x9 glyph cells.                                            |
| **Clear text** | Anything read as sentences: dialogue, chat log, letters, lore fragments, item and technique descriptions, settings, request text, tooltips over two lines | DOM overlay using the system UI font stack, sized in CSS, inside pixel-art frames (9-slice border images) |

Hard rules:

1. Pixel text is used only if its capital height is at least 2.0 mm physical on the current device at the current scale. Below that, the element switches to clear text automatically. The check lives in one function used by every label.
2. More than 24 characters, or more than one line, is always clear text.
3. Clear text respects the OS font size setting and an in-game text scale (80% to 160%). Layouts reflow. Nothing truncates silently.
4. Minimum contrast 4.5:1 for all text against its panel.
5. Numbers that matter in combat (Health, damage) are pixel text with a dark outline, and big.
6. The chat ticker on the HUD is clear text at small size. Chat is read constantly and must be effortless.

Clear text is styled to belong: off-white on dark panel colors from the master palette, pixel frames, pixel icons inline. It is not themed as a different app.

## Touch rules

- Minimum touch target 44 x 44 CSS px. Preferred 48.
- All frequent actions reachable in the lower 40% of the screen in portrait.
- No action requires two simultaneous touches in Flow.
- No hover-only information. Long-press shows details anywhere a desktop user would hover.
- Destructive actions (discard, demolish) need a hold-to-confirm, not a modal.
- The browser's own gestures are suppressed inside the game surface (pull to refresh, text selection, double-tap zoom, context menu). Pinch zoom stays available on clear-text reading panels.

## HUD

Minimal by default. Elements fade when unchanged for a few seconds, return on change.

- Three pool bars, top left. Status icons under them.
- Clock and weather glyph, top center. Tap for calendar.
- Minimap toggle, top right. Tap for full map.
- Chat lane above the thumb zone (see Message lanes).
- Four technique buttons, context button, menu, bag.
- Target frame (name, health, stagger) when locked.
- Party frames, left edge, when in a party.
- No quest tracker by default. The player can pin one request, which shows as a single line of the asker's own words.

## Action meter

Every timed step the player performs (gather sweep, craft step, fishing bite, and any later minigame) is an **action meter** (D16).

- **Where.** In the world view, centered above the avatar's head, 6 logical px above the name plate. If that would leave the upper world view (near the top edge, or under the status row) it flips below the avatar's feet. It never enters the thumb zone and never covers the thing being worked.
- **Size.** At least 72 logical px wide and 7 tall for a sweep or rhythm track. A trace or hold step uses a panel up to 120 px square, anchored the same way, with the avatar still visible beside it. Widths are in `src/content/balance/ui.ts`.
- **Work feedback.** The avatar plays the work animation of the skill (swing, chop, stir, hammer, cast) on each beat. The node or station being worked gets a 1 px highlight outline. A hit lands with a small spark and a sound on the node, not on the meter.
- **Input.** Unchanged: one tap anywhere in the lower zone, or the context key, is a hit. Tapping the meter itself also counts.
- **Leaving.** Moving off cancels a gather as today. The meter fades in 150 ms.
- Reduced motion: no spark, no pulse, the marker still moves.

## Message lanes

Every transient message has one lane (D21). Lanes never overlap each other, the action meter, or the thumb zone. A **System log** keeps every message for review.

| Lane        | Where                                           | What                                                                                   | Rules                                                                                                                                     |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Floaters    | Over the avatar, pixel text                     | Pickups ("+2 Moss"), XP pips, damage numbers                                           | Up to 24 characters. Repeats within 1.5 s merge ("+5 Moss"). Max 3 stacked.                                                               |
| Skill ticks | Under the pool bars                             | Skill XP gains                                                                         | As today (M3). Fades when unchanged.                                                                                                      |
| Notices     | Under the clock, clear text                     | Short system news: request updated, item cannot be carried, a Waystone attuned, a hint | Max 2 visible, newest on top. 2.6 s each, longer for longer text (40 ms per character, capped at 6 s). Merges duplicates. Tap to dismiss. |
| Banners     | Under the clock, wide, one at a time            | Rank-ups, awakening, a Path earned, a Singular step, a world first                     | Queue, never stack. 3 s. Notices wait while a banner shows.                                                                               |
| Chat        | Left, directly above the thumb zone, clear text | Traveler and system chat (M5 adds volume)                                              | 2 lines, newest at the bottom. Tap to open the chat sheet. A collapse button hides it to a one-glyph unread count.                        |
| Hints       | Notices lane, with a hint glyph                 | First-time contextual hints                                                            | Same lane as notices, never a separate box over the clock.                                                                                |

The chat sheet opens from the bottom, half height, with channel tabs (World, Local, Party, Guild, Whisper, System). The System tab is the System log: every notice, banner and pickup since login, newest at the bottom.

While the Menu, a shop, dialogue or a craft panel is open, floaters and notices pause and queue. Banners queue too. Nothing is lost.

## The Menu

Presented in-fiction as the game's system window (the player is "in a VR game"). Opens with the menu button or a swipe up from the bottom edge. Full-height sheet in portrait with a tab bar at the bottom. Rebuilt in M4 (D21) on a small set of shared parts so every tab behaves the same.

| Tab       | Contents                                                                          |
| --------- | --------------------------------------------------------------------------------- |
| Character | Avatar, gear, worn Paths, Forms, pools, loadouts                                  |
| Skills    | Awakened skills by family, rank, next Trial hint, techniques                      |
| Bag       | Inventory grid, filters, quick-use slots                                          |
| Map       | World map with fog, Waystones, player notes, rumor marks                          |
| Chronicle | Completion by category, bestiary, recipes, fish, fragments as found, Theory Board |
| Social    | Friends, party finder, guild, rankings, mail, full chat log                       |
| Routines  | Workers, assignments, offline cap, Tactics editor                                 |
| System    | Settings, save status and export, calendar, help, **Log Out**                     |

Tabs whose system does not exist yet are hidden, not greyed out. The tab bar shows a 16 px icon and a short label for each tab, and a badge dot when something new is inside.

Log Out returns to the login screen. It always works. (It matters to the lore that it does.)

The game does not pause when the Menu is open in the open world (it is an online game in-fiction), except: the game fully pauses when the tab or app loses focus, and the Menu is safe to open in hubs. An accessibility option makes the Menu pause the world.

**Shared parts.** Every tab is built from these, so the look and the touch behavior are learned once:

- **Header.** Tab title at left, one or two tab-level actions at right (sort, filter). Never more than two.
- **Section.** A collapsible group with a title and a count ("Gathering, 3"). Remembers open or closed per player.
- **Row.** Icon, name, one line of state at right (rank, quantity, price). Whole row is the touch target, at least 48 px tall. Tap opens the detail sheet. Long-press shows the same text as a tooltip.
- **Grid cell.** For the bag and storage: icon, quantity corner, quality pip, broken mark. 48 px minimum.
- **Detail sheet.** Slides up over the tab at about 60% height: large icon, name, description in clear text, numbers as a two-column list, and at most three action buttons at the bottom (the primary one on the thumb side). Back or a swipe down closes it.
- **Empty state.** One sentence that says what fills this space and how ("Skills awaken the first time you use them."), never a blank panel.

**Navigation rules.**

- One level of depth below a tab: a detail sheet. No sheet opens another sheet. A confirm is a hold-to-confirm on the button (Touch rules).
- Back (system back, Escape, or swipe down) closes the sheet first, then the Menu.
- The Menu reopens on the last tab and scroll position.
- Gear, technique and loadout changes made in the Menu show at once on the doll and the HUD behind the sheet.

**Character tab layout.** The doll at the center, drawn at 2x, with its gear slots around it (head, body, legs, main, off, two trinkets later). Under it, the three pools with their numbers, then worn Paths as chips, then the two loadouts side by side.

**Skills tab layout.** Awakened skills only, by family, each family a section. A row shows name, rank name and a progress bar. The detail sheet shows the XP to next point, the Trial hint or progress, and that skill's techniques with their source state ("Known", "Insight 18 of 30", "Someone in Hearthford teaches this"). Assigning a technique to a slot happens from the detail sheet.

## Avatar setup

Presented as the game's own character setup screen (D22). No class, no stats, no starting choice that changes power.

- **Body:** two body types, three heights (short, middle, tall: the sprite is 1 px shorter or taller in the legs).
- **Face:** eight eye shapes, six brow shapes, five mouths, face marks (none, freckles, a scar, a birthmark, war paint), each mark with its own color.
- **Skin:** six tones.
- **Hair:** twelve styles, eleven colors, an optional second color for tips or streaks. Facial hair: none, stubble, short, full.
- **Clothes:** the starting rags are fixed, but their two colors are chosen. Those two colors are remembered as the character's "own" colors and offered as the default dye on crafted gear.
- **Accessory:** none, headband, scarf, earring, eyepatch, flower.
- **Origin (optional):** a short line of flavor with a pixel vignette. Each origin draws its wake point from a subset of the eight, and sets the first contextual line on waking. "Unremembered" is the default and draws from all eight. Origins give no item, stat, XP, technique or reputation. Six in Dawnmeadow: Unremembered, Farmhand, Road-weary, Hunter's ward, River-found, Pilgrim's child.
- **Randomize** button re-rolls every look option at once. Each group also has its own small dice.
- The preview turns with a drag and shows the avatar on a patch of the chosen origin's ground.

Everything here is cosmetic and is changeable later at a mirror in the inn (M6 adds a barber and a tailor for paid changes; until then the mirror is free).

## Dialogue

Clear text in a bottom sheet with the speaker's pixel portrait. Tap to advance, choices as large buttons. A log of the conversation is scrollable. Travelers' lines look like chat messages, NPCs' lines look like speech. That difference is deliberate.

## Feedback

- Every tap answers within 100 ms (visual, plus haptic where supported).
- Hit pause (2 to 4 frames) and a small screen shake on heavy hits. Both scale down with the reduced-motion setting.
- Skill gains show as a small unobtrusive tick near the pool bars. Rank-ups and awakenings get a banner. Lanes are in Message lanes.
- Rare discoveries get a distinct chime and a Chronicle badge on the menu button.

## Save status

A small glyph in the System tab and on the login screen shows trust state: Intact or Flagged. See tech/02. An export reminder appears after every 5 hours of play since the last export, dismissible.

## Accessibility

- Text scale, HUD scale, button size and opacity, left-handed mirror.
- Colorblind-safe: no information by color alone. Status, rarity, and element all have shapes or glyphs. Three palette presets tested for protan, deutan, tritan.
- Reduced motion (no shake, no flashes, gentler transitions). Honors the OS setting on first run.
- Flash limit: no full-screen flashes above 3 per second, ever.
- Hold-versus-toggle options for sprint, block, and aim.
- Assist options from 04-combat. Tactics assist as an input alternative.
- Captions for meaningful sounds (off-screen telegraph cues appear as edge indicators).
- All Menu and dialogue UI is DOM, so it is screen-reader navigable with proper roles and labels. The action world is not, and this is documented in Help.
- Volume sliders for music, effects, ambience, UI. Game is fully playable muted.

## Onboarding

No tutorial mode. Contextual hints: one line, appears the first time an action becomes possible, dismissed by doing it. A Help section in System lists everything hints would have said. Hints never appear for hidden-layer content.

## Art direction for UI

- Master palette of 32 colors (defined in tech/03). UI uses a 6 color subset.
- Panels are 9-slice pixel frames with 2 px borders at logical scale.
- Icons are 12x12 or 16x16 pixel art. Every icon has a text label reachable by long-press.
- Fantasy game UI with a hint of "system window": thin, clean, slightly luminous. It should read as a game inside the fiction.
