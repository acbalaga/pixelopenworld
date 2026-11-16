# 04 Combat

Real-time, top-down, readable on a small screen, playable with one thumb. Fights are short (5 to 20 seconds for common enemies, 2 to 5 minutes for bosses).

## Control schemes

Two schemes ship. Gate G1 decides the default. Both are always available in settings.

### Flow (one thumb, portrait default candidate)

| Gesture | Action |
|---|---|
| Touch and drag anywhere in the lower zone | Floating stick appears under the thumb. Move. |
| Basic attack | Automatic. While an enemy is in weapon reach and in the facing arc, the avatar attacks on the weapon's cadence, including while moving. |
| Tap an enemy | Lock target. Avatar faces it. Tap empty ground to unlock. |
| Flick (fast short swipe) | Dodge in the flick direction. Costs Stamina. Has invulnerable frames. |
| Tap one of four technique buttons | Use technique. Buttons sit in an arc above the thumb rest. When the thumb leaves the stick the avatar keeps its heading for 200 ms so a tap does not stop movement dead. |
| Hold a technique button | Aim (shows a cone or line), release to fire. |
| Tap the context button | Interact, gather, talk, pick up. Appears only when something is in range. |

Skill in Flow is positioning, dodge timing, and technique choice. Not button mashing.

### Classic (two thumbs)

Fixed stick left, attack, dodge, and four technique buttons right. Basic attack is manual with a three-hit combo. Same damage outcomes as Flow at equal play. Default in landscape and on gamepad or keyboard.

Both schemes get: left-handed mirror, adjustable button size and opacity, haptic ticks on hit and on perfect dodge.

## Resources

- **Health.** Regenerates only out of combat, slowly. Food and Mending restore it.
- **Stamina.** Dodge, sprint, weapon techniques. Regenerates fast. Running dry means no dodge. That is the main way players die.
- **Focus.** Magic and special techniques. Regenerates slowly. Faster while standing still.

## Weapons

Five weapon families, each tied to an Arms skill, each with a distinct cadence, reach, and one built-in property.

| Family | Skill | Feel | Property |
|---|---|---|---|
| Swords, daggers | Blades | Fast, short reach | Bonus damage from behind and on staggered targets |
| Hammers, axes, greatswords | Heavy Arms | Slow, wide arc | Builds stagger fast, breaks guards |
| Spears, staves | Polearms | Medium, long reach | Hits two tiles deep, keeps enemies out |
| Bows, slings | Archery | Ranged, needs space | Charge by standing still |
| Fists, claws | Unarmed | Very fast, tiny reach | Hits refund Stamina |

Off-hand: shield (Shieldcraft, hold to block, timed block parries), focus orb (magic strength), tool (lantern, instrument), or nothing (faster dodge recovery).

Two loadouts can be saved and swapped with one tap out of combat, with a short lockout in combat.

## Magic

Six schools. Each is a skill. Spells are techniques.

| School | Role | Interacts with world |
|---|---|---|
| Ember | Damage over time, area | Burns brush, lights torches, melts ice |
| Tide | Control, pushes, soaking | Douses fire, fills basins, grows crops |
| Gale | Mobility, knockback, ranged | Spins windmills, clears fog and sand |
| Stone | Defense, walls, heavy single hits | Makes platforms, blocks beams, holds plates |
| Mending | Heals, cleanses, wards | Revives withered plants, soothes creatures |
| Hexing | Debuffs, drains, summons | Reveals hidden things, speaks with echoes |

### Reactions

Kept to a small, learnable table. Wet plus Ember makes Steam (obscures, light damage). Wet plus Gale makes Chill (slow). Chill plus Stone makes Shatter (burst). Burning plus Gale spreads fire. Hexed targets take extended status durations. Reactions work on the environment and on the player too.

## Statuses

Burning, Wet, Chilled, Staggered, Poisoned, Hexed, Rooted, Dazed, Warded, Fed (food buff), Rested. Each has one icon and one clear rule. Maximum of four shown per unit.

## Stagger

Every enemy has a stagger bar under its health bar. Fill it and the enemy is helpless for a moment and takes bonus damage. Heavy Arms and parries fill it fastest. This gives melee a tactical goal beyond the health bar and gives bosses phases the player controls.

## Damage model

Kept simple so the player can reason about it and so the offline settlement can estimate fights without simulating them.

`damage = (weaponPower * techniqueMultiplier * skillFactor) * elementFactor * (100 / (100 + targetDefense))`, then crit and situational multipliers.

`skillFactor` runs from 1.0 at rank 0 to 2.0 at rank 100. All coefficients live in `src/content/balance/combat.ts`. A balance harness (POW-M3-12) simulates fights from data to check time-to-kill targets per tier.

Time-to-kill targets at par: common enemy 4 to 8 seconds, elite 20 to 40 seconds, miniboss 60 to 90 seconds, regional boss 3 to 5 minutes.

## Enemies

About 160 creatures built from 12 behavior archetypes: Chaser, Skirmisher, Charger, Shooter, Lobber, Guard, Burrower, Flyer, Swarm, Caster, Mimic, Summoner. A creature is an archetype plus stats, element, telegraph timings, drops, and one quirk.

Rules:
- Every attack has a telegraph. Ground markers for area attacks, a flash and wind-up for melee. Minimum 350 ms at tier 1, tightening to 200 ms at tier 8.
- No more than six active attackers engage at once. Others circle.
- Enemies leash to their zone and reset if pulled too far.
- Creatures have non-combat interactions. Many can be fed, soothed, tamed, sneaked past, or scared off. Some are never hostile unless provoked.

## Bosses

- 8 regional bosses, 8 field bosses, about 30 dungeon and mini bosses, plus Undercroft and hidden bosses.
- Three phases maximum. Each phase adds one mechanic. Nothing is a pure damage check.
- **Non-combat resolutions.** Each regional boss can also be passed by a second authored route: out-cooked, out-played in song, tamed, sneaked around, bargained with, or solved as a puzzle. The alternate route is as hard as the fight and uses skill at rank 30 to 75 depending on tier. This is what makes a pacifist merchant playthrough real.

## Companions in combat

Party members (Travelers, tamed creatures, hired hands) fight by simple role AI: Vanguard, Striker, Support. They follow the player's target lock. They cannot die permanently. Downed companions revive after the fight.

## Death

In-fiction the player "desyncs" and respawns.

- Respawn at the last touched Waystone or bed.
- Carried coin: 10% is left at the death spot as an Echo, recoverable. A second death before recovery loses it.
- Equipped gear takes a durability hit. Nothing is destroyed. Repair at any smith or by Smithing.
- Dungeon progress stays.
- No XP loss ever.

## Difficulty and assists

No difficulty select. Region tiers are the difficulty. Assist options in settings, all free to toggle and none flagged or penalized: longer telegraphs, auto-dodge on first hit per fight, slower enemy cadence, stronger aim assist.
