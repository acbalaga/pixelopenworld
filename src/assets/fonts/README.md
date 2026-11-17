# Bundled fonts

**Atkinson Hyperlegible**, Latin subset, regular (400) and bold (700). Used for clear text only
(Menu, descriptions, anything read as sentences). The pixel font is drawn from data in
`src/content/fonts` and is not a file.

- Designed by the Braille Institute of America, Inc. Licensed under the SIL Open Font License 1.1.
  The full text and copyright line are in `OFL.txt` and must ship with the fonts.
- Source: the `@fontsource/atkinson-hyperlegible` 5.3.0 npm package (`files/*-latin-400-normal.woff2`
  and `*-latin-700-normal.woff2`). Copied here unmodified. It is not an npm dependency of the game.
- The OFL allows bundling and use in a commercial game. The files must not be sold on their own,
  and a modified copy must not use the reserved font name.
- Approved by the owner on 2026-11-17 as an exception to "no external art" in CLAUDE.md.
- Other scripts (Cyrillic, Greek and so on) are not included. They fall back to the system font.
