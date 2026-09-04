# Fracture City v0.11.1 — the front door

v0.11.0 was your campaign build with four cosmetic fixes. **v0.11.1 fixes the
three things that made the game unplayable from the menu.** The campaign itself
is untouched.

## What was actually wrong

**There were no saves.** `loadEdits()` is written in this file and was never
called from anywhere — not once. Every block you have ever placed was written to
`data/fracture-city-game/edits-<seed>.json` and never read back. Eighteen of
those files exist on this machine. The city seed was never recorded either, so
every launch rolled a brand-new random world. There was nothing to continue, and
no code path that could have continued it.

**Campaign progress was global, not per-world.** One `campaign.json` with no
world attached, so it survived NEW CITY, FREE ROAM and every reseed. Starting a
new city really did put you back in the middle of the same story. That is the
"stuck mid-campaign".

**The opening film flies the camera through walls.** The shot list is authored
against fixed coordinates, so this is identical on every seed, for every player,
every time. Sampled 61 points along each path across six cities:

| shot | | inside solid geometry |
|---|---|---|
| 3 | street level, past the lit fronts | 16 / 61 — brick |
| 5 | down among the barrels | **45 / 61 — glass** |

Three quarters of shot 5 is spent inside a shop window.

And `EDITS` was never cleared between cities, so a new world inherited the last
world's block edits at the same coordinates.

## What it does now

**A front screen that is a list of things you can do.** Your resident at the
top with name, handle and colours. CONTINUE naming the actual save and how far
in you are. NEW GAME — THE SECOND LIGHT. NEW GAME — FREE ROAM. SAVES.

**Real save slots.** A slot owns a seed, a campaign, a position, an inventory,
a hotbar, the clock and the peaceful flag. Up to twelve, newest first, each with
its chapter, time played, when you last touched it and its seed. Deletable.
Autosaves every 25 seconds while you are actually in the city — never during the
film or a menu, where the position it would record is not where you are — and
again at the start of every chapter.

**RECOVER OLD CITIES.** Scans for `edits-<seed>` files with no slot behind them
and gives each one a slot. Your eighteen unreachable cities open again, as free
roam, with your builds in them.

**Solved camera paths.** Not guessed — a search over offsets around each
authored move, scored on clearance to the nearest solid block in six directions
and penalised for drifting from the original framing. Both shots now hold open
air the whole way, and the look targets moved with them so they still point
where they pointed.

**Captions that cannot be swallowed.** Cues queue, hold 1.5s minimum, and a shot
will not end until its last cue has been on screen. Previously a slow frame that
straddled two cues showed only the second, and one straddling the end of a shot
showed neither.

**A film that cannot strand you.** The old loop was a `requestAnimationFrame`
chain: if the tab was backgrounded or the GPU stalled, it simply stopped and the
campaign it was opening for never started — leaving you in a city with no menu,
no story and no HUD. A watchdog on a plain timer, which rAF starvation cannot
touch, now ends the film and starts the chapter anyway. The callback fires
exactly once however it ends.

## Verified

| suite | result |
|---|---|
| the front door — profile, slots, restore, recovery | 12 / 12 |
| the film cannot strand you | 5 / 5 |
| campaign playthrough to THE SECOND LIGHT | 7 / 7 |
| `_verify_story.js` (yours) | pass |
| siege | 24 / 24 |
| thought bubbles | 18 / 18 |
| newswire | 16 / 16 |
| web beta, served as a static site | 12 / 12 |

Round-trip proof for saves: four blocks placed, saved, the world replaced with a
different city (0/4 present), slot reloaded — 4/4 back.

## Still open

The Fourth Watch ridge sits a metre above the waterline, so you walk a dry
raised causeway rather than "stone and sand beneath shallow water". Still a
design call, not a bug — see the note in the previous changelog.
