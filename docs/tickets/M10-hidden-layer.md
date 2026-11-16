# M10 The Hidden Layer: lore and completion

**Result:** the mystery is in the world, findable and never told. The Chronicle tracks 100%.

**Gate G10:** a blind playtester finds the first Truth with no prompts, and another ignores it all and still has a full game.

Every executor on this milestone reads design/08-lore-SPOILERS in full, and follows "Delivery rules" without exception.

---

### POW-M10-01 Refinement: M10 specs to READY
Size: L      Depends: M9 complete      Status: DRAFT (design authority)

Goal: READY specs. The full text of all 144 fragments, their placements, the evidence sets for the eight Truths, the anomaly schedule, the Keeper's lines, and the Form questlines are written here by the design authority and approved by the owner. Executors implement and place. They do not write lore.
Acceptance: owner approves the lore package.

### POW-M10-02 Fragment system and Chronicle lore page
Size: M      Depends: M10-01      Status: DRAFT

Goal: fragments can be found and are recorded verbatim.
Scope: fragment sources (tablet, terminal, note, item text, graffiti, overheard line). Discovery event and a quiet chime. Chronicle page listing found fragments in found order with place and date, no summaries and no "x of 144" until the first Truth is opened. Bookshelf furniture displays them at home.
Acceptance: no code path shows fragment text the player has not found. The Chronicle contains no authored explanation text (content validation rule on the lore strings table).

### POW-M10-03 Cipher and Deciphering
Size: M      Depends: M10-02      Status: DRAFT

Goal: the script can be learned by skill or cracked by hand.
Scope: cipher font (26 letters, 10 numerals). Rendering of fragments with per-glyph translation state. Deciphering XP from seeing and studying glyphs. Progressive auto-translation by glyph familiarity. A manual glyph key the player can fill in on the Theory Board, which is honored immediately if correct. Deciphering Trials.
Acceptance: a fragment renders correctly at 0%, partial, and 100% knowledge. Manually entering the right mapping reveals text without skill. Wrong guesses are allowed and shown as the player's own annotation.

### POW-M10-04 Place the fragments
Size: L      Depends: M10-02, M10-03      Status: DRAFT

Goal: all 144 fragments in the world at their approved locations.
Scope: replace placeholders across the Continent and Undercroft. Fragment-bearing item descriptions and overheard lines wired to their triggers. Placement follows the hours schedule in the spoilers doc.
Acceptance: an audit tool lists every fragment with its location and reachability. A bot pathing check reaches each one.

### POW-M10-05 Theory Board
Size: L      Depends: M10-02      Status: DRAFT

Goal: the player assembles their own conclusions.
Scope: a board in the Chronicle where found fragments are cards. Drag to group and link. Free annotation from a fixed vocabulary of tags plus the cipher key. When a group contains an approved evidence set, the corresponding place quietly becomes accessible in the world. The board itself gives no confirmation.
Acceptance: each of the eight evidence sets opens its place. Near-miss sets open nothing and say nothing. Board is usable one-handed on a phone.

### POW-M10-06 Anomalies
Size: L      Depends: M10-01, M5 complete      Status: DRAFT

Goal: the quiet oddities that are the evidence.
Scope: the always-online Traveler `mira_` and her pier. Exact-schedule regularities and the weekly repeated first line for selected Travelers. The repeated story at Close Friend. Date references in mail and chat. "Maintenance" announcements with their small effects. The population counter terminal. The rare reply chip the player could not know. Each anomaly has an innocent reading (per the clue table).
Acceptance: each anomaly triggers under its conditions in scenario tests and at no other time. None is announced, logged as a hint, or marked on the map.

### POW-M10-07 Truth locations 1 to 4
Size: L      Depends: M10-05      Status: DRAFT

Goal: the reading room, the Workshop, the Empty Server, the Office.
Scope: author each location in its reserved sealed room. Environmental storytelling only. The Office uses a distinct non-fantasy tile set, the only one in the game.
Acceptance: screenshots. No text in any location explains what it is. Each is entered only after its evidence set is linked.

### POW-M10-08 Truth locations 5 to 8 and the Keeper
Size: L      Depends: M10-07      Status: DRAFT

Goal: the Garden, the Archive, the Pier, and the meeting.
Scope: the Archive renders one pillar per Traveler with brightness by Regard. The Keeper meeting as specified: plain system messages, one question, both answers honored. "No" empties hubs gradually over several in-game days and is reversible at the same room. "Yes" enables the new Close Friend lines. Better Drafts and notes flag for M11.
Acceptance: both answers and the reversal tested end to end. The Log Out button works at every moment of the sequence. Emptied hubs do not break requests, shops, or Routines (NPCs are unaffected, tests).

### POW-M10-09 Forms
Size: L      Depends: M10-01      Status: DRAFT
Refs: design/03-progression (Forms)

Goal: six ways to stop being human for a while.
Scope: Form system (sprite set swap, movement and ability changes, restrictions, toggle at shrines or by item). The five discoverable Forms with their hidden questlines. The sixth granted after the Keeper meeting.
Acceptance: each Form's trade-off is enforced (tests). Forms never soft-lock (leaving a Form is always possible).

### POW-M10-10 Chronicle completion and the 100% audit
Size: L      Depends: M10-04, M9 complete      Status: DRAFT
Refs: design/10-content-budget (What 100% means)

Goal: 100% is defined, tracked, and provably reachable.
Scope: Chronicle with all ten categories, per-region breakdowns, and the separate "beyond" stars. Unknown entries show as blanks, not as a list of what exists. `tools/audit-100`: static reachability for every tracked item plus a long bot campaign that drives completion as far as policies allow, reporting anything unreachable. A quiet acknowledgment at 100% (a letter, a cosmetic, nothing that ends the game). `docs/ops/gate-g10.md`.
Acceptance: audit reports zero unreachable items. Category counts match design/10. Owner action: G10 with two blind playtesters.
