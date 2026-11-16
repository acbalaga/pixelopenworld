# Tech 03 Asset pipeline

All art and audio are data in this repo. A bake step turns the data into atlases and manifests. Nothing is drawn in an external tool and nothing is downloaded from an asset store.

This is the highest craft risk in the project. Text-authored pixel art goes wrong easily. The rules below exist to keep it coherent.

## Art bible

### Palette

One master palette of 32 colors, defined once in `content/sprites/palette.ts`. Every sprite and tile uses only these indices. Structure:

- 4 neutrals (near-black to off-white, slightly warm)
- 7 hue ramps of 4 steps each: skin and wood, foliage, water, stone, fire, magic violet, metal
- Ramps hue-shift (shadows lean cool and toward blue-violet, highlights lean warm) instead of only changing brightness

POW-M0-06 proposes the exact hex values with a rendered swatch sheet for owner approval. After approval the palette changes only by planning PR.

Day, dusk, night, and weather are done by palette-level color grading at render time (a lookup applied to the final frame), not by separate art.

### Rules

1. **Sizes.** Tiles 16 x 16. Humanoids 16 wide x 24 tall on a 24 x 32 canvas (room for weapons and hair). Small creatures 16 x 16. Large 32 x 32. Bosses up to 64 x 64. Icons 12 x 12 and 16 x 16.
2. **Outline.** Characters and creatures have a 1 px outline in the darkest neutral, broken on the lit side. Terrain has no outline.
3. **Light.** From the top left, everywhere.
4. **Shading.** At most 3 tones per material on a sprite. No dithering on characters. Dithering allowed on large terrain only.
5. **Readability first.** A silhouette must be recognizable at 1x. If two creatures share a silhouette, one changes.
6. **No anti-aliasing, no gradients, no sub-pixel anything.**
7. **Top-down three-quarter view.** Walls show their front face. Characters are drawn as if seen from slightly above.
8. **Animation.** Walk: 4 frames per direction. Idle: 2. Attack: 3 to 4. Hurt: 1. Four directions, with left produced by mirroring right unless the sprite is asymmetric.

## Sprite format

Authored as text grids so they diff cleanly and so an agent can write and revise them.

```ts
export const mossling: SpriteDef = {
  id: 'creature.mossling',
  size: [16, 16],
  origin: [8, 14], // feet position
  key: { '.': null, k: 0, g: 9, G: 10, l: 11, w: 3 }, // char -> palette index
  frames: {
    idle_0: [
      '................',
      '.....kkkkkk.....',
      '....kGGGGGGk....',
      // ... 16 rows
    ],
    idle_1: [/* ... */],
  },
  anims: { idle: { frames: ['idle_0', 'idle_1'], fps: 2 } },
};
```

The bake validates: every row has the right width, every character is in `key`, every index is in the palette, every animation names real frames.

### Paper dolls

Humanoids (the player, Travelers, NPCs) are composed from layers so that hundreds of distinct people come from a small set of parts: body, skin tone (palette swap), hair style, hair color (swap), eyes, outfit top, outfit bottom, headgear, main hand, off hand. Each layer provides the same frame set. The bake or the runtime composites them. Equipment the player wears is visible.

### Generators

Hand-authoring every variation does not scale. Use code to multiply good hand-made bases:

- **Palette swaps** for creature variants and gear tiers.
- **Autotiling.** Terrain transitions (grass to dirt, land to water, cliff edges) are generated from a small set of authored edge pieces using a 47-tile blob set.
- **Scatter and variation.** Grass, flowers, pebbles, and tree variants come from parameterized generators with a seed.
- **Item icons** from shape templates plus material swaps (a sword template times 8 metals).

A generator's output is still baked into the atlas and reviewed as an image.

## Tiles

- Tile definitions name their sprite, collision shape (none, full, half variants, water, ledge), layer (ground, detail, object, overhead), and tags (flammable, diggable, climbable).
- Overhead layer (tree canopies, roofs) draws above entities and fades when the player is underneath.
- Animated tiles (water, torches) have 2 to 4 frames on a global timer.

## The bake

`npm run bake` runs `tools/bake-assets`:

1. Load and validate all sprite and tile definitions.
2. Run generators.
3. Composite frames, pack them into atlas textures (maximum 2048 x 2048, split by load group: core, ui, region-N).
4. Write PNGs and a JSON manifest (frame rectangles, origins, animations) to `baked/`.
5. Write **contact sheets**: one PNG per content group showing every sprite at 1x and 4x with its id, on both a light and a dark background.

Bake output is committed. CI re-runs the bake and fails if the output differs from what is committed, so definitions and atlases cannot drift.

## Review workflow

Because nobody is looking at a canvas while authoring:

- Every PR that adds or changes art attaches the relevant contact sheets and at least one in-game screenshot (Playwright) showing the art in context at phone resolution.
- A dev page (`/dev/sprites` in dev builds) shows any sprite animated, at several scales, on real terrain.
- The executor must look at the rendered output before opening the PR and state what they checked: silhouette at 1x, palette discipline, light direction, animation loop.
- The owner reviews art at each gate. Art that fails review is revised by ticket, not patched ad hoc.

## Audio

### Sound effects

Synthesized at runtime from parameter presets in the style of sfxr: waveform, envelope, pitch slide, vibrato, noise mix, filter. A preset is about a dozen numbers.

```ts
export const sfxHitLight: SfxDef = {
  id: 'sfx.hit_light',
  wave: 'noise',
  attack: 0,
  sustain: 0.03,
  decay: 0.08,
  freq: 440,
  slide: -0.3,
  lowpass: 0.6,
  gain: 0.5,
  variance: 0.08,
};
```

`variance` randomizes pitch slightly per play so repeated sounds do not grate.

### Music

Tracker-style pattern data played by a small Web Audio synth: 4 to 6 channels (two pulse or triangle leads, bass, noise percussion, one pad), patterns of note events, an order list, tempo, and per-channel instrument presets.

- Each region has a day theme and a night variation that shares its melody. Hubs, dungeons, bosses, and festivals have their own.
- Music crossfades by region and ducks under dialogue.
- Tracks loop with no audible seam.
- Composition guidance: clear, singable lead melodies. Pentatonic and modal writing is forgiving. Keep arrangements sparse so they sit under sound effects on a phone speaker.

A dev page (`/dev/audio`) plays any effect or track and shows a simple pattern view.

### Platform rules

- The audio context is created and resumed on the first user gesture (the Log In tap).
- Audio stops when the page is hidden.
- A global limiter prevents clipping when many effects fire.
- Maximum 16 simultaneous voices. Lowest priority voices are dropped first.

## Fonts

- Two bitmap fonts for pixel text (5x7 and 7x9 cells), authored in the same text-grid format, covering ASCII plus the symbols the game uses.
- The cipher glyph set (26 letters and 10 numerals) as a third font, used on tablets and in the Theory Board.
- Clear text uses the system UI font stack. No web fonts are downloaded.

## Icons and PWA assets

App icons, the maskable icon, and splash images are produced by the bake from a single authored pixel emblem, scaled by integer factors.
