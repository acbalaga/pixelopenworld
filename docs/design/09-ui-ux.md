# 09 UI and UX

## Screen model

Portrait first. The game renders to a low-resolution logical canvas and scales by an integer factor so pixels stay square and sharp.

- Logical width: 180 to 239 px. Scale = the largest integer that keeps logical width at or above 180.
- Logical height: whatever the device gives at that scale (tall phones see more world).
- The canvas uses `image-rendering: pixelated`. Device safe areas (notch, home bar) are respected and never hold controls.

### Portrait layout

```
+--------------------------+
| status row  | clock | map|   pools, statuses, time, minimap toggle
|                          |
|        WORLD VIEW        |   top ~62% of height
|                          |
| chat ticker (2 lines)    |
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

| Renderer | Used for | How |
|---|---|---|
| **Pixel text** | HUD numbers, button labels, names over heads, damage numbers, short labels up to about 24 characters | Bitmap font on the canvas. Two sizes: 5x7 and 7x9 glyph cells. |
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
- Chat ticker above the thumb zone.
- Four technique buttons, context button, menu, bag.
- Target frame (name, health, stagger) when locked.
- Party frames, left edge, when in a party.
- No quest tracker by default. The player can pin one request, which shows as a single line of the asker's own words.

## The Menu

Presented in-fiction as the game's system menu (the player is "in a VR game"). Opens with the menu button or a swipe up from the bottom edge. Full-height sheet in portrait with a tab bar at the bottom.

| Tab | Contents |
|---|---|
| Character | Avatar, gear, worn Paths, Forms, pools, loadouts |
| Skills | 36 skills by family, rank, next Trial hint, techniques |
| Bag | Inventory grid, filters, quick-use slots |
| Map | World map with fog, Waystones, player notes, rumor marks |
| Chronicle | Completion by category, bestiary, recipes, fish, fragments as found, Theory Board |
| Social | Friends, party finder, guild, rankings, mail, full chat log |
| Routines | Workers, assignments, offline cap, Tactics editor |
| System | Settings, save status and export, calendar, help, **Log Out** |

Log Out returns to the login screen. It always works. (It matters to the lore that it does.)

The game does not pause when the Menu is open in the open world (it is an online game in-fiction), except: the game fully pauses when the tab or app loses focus, and the Menu is safe to open in hubs. An accessibility option makes the Menu pause the world.

## Dialogue

Clear text in a bottom sheet with the speaker's pixel portrait. Tap to advance, choices as large buttons. A log of the conversation is scrollable. Travelers' lines look like chat messages, NPCs' lines look like speech. That difference is deliberate.

## Feedback

- Every tap answers within 100 ms (visual, plus haptic where supported).
- Hit pause (2 to 4 frames) and a small screen shake on heavy hits. Both scale down with the reduced-motion setting.
- Skill gains show as a small unobtrusive tick near the pool bars. Rank-ups get a banner.
- Rare discoveries get a distinct chime and a Chronicle badge on the menu button.

## Save status

A small glyph in the System tab and on the login screen shows trust state: Verified, Pending (played offline, will verify on reconnect), Unverified. See tech/02. An export reminder appears after every 5 hours of play since the last export, dismissible.

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
