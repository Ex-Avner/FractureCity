# Fracture City v0.12 — sound, feel, and something else out there

Four systems, 133 tests. The campaign, the saves and the world are untouched
except where noted.

---

## Sound — 16/16

The game made four noises before this: a scrape when you mined, a chime when
you picked something up. That was the complete list. A pulse pistol that fires
in silence does not read as a weapon, it reads as a UI event, which is most of
why combat felt thin.

**Everything is synthesised at runtime. There are no audio files.** A gunshot is
a noise burst through a bandpass with a 90ms decay; a footstep is the same idea
with different numbers; a zombie is two detuned saws under a wandering lowpass.
The module adds nothing to the payload beyond its own source.

- **Weapons are three layered voices** — crack, body, tail. The scatter's crack
  is 145ms against the pistol's 85ms and its body sits at 120Hz against 190Hz,
  so they are different guns rather than the same click at two pitches.
- **Footsteps know the surface.** Seven of them — stone, metal, glass, signal,
  organic, water, ice — and they are spaced by distance travelled, not a timer,
  so sprinting speeds them up for free.
- **Positional.** Pan and attenuation from where a thing is relative to the
  camera. A fight behind you sounds behind you.
- **One bus.** Master gain into a compressor. A scatter round is six pellets and
  six impacts inside 40ms; without it they sum past 0dBFS and crackle.
- **A voice cap of 26.** Sound in a horde is unbounded by nature. 400 requests
  peak at 26 and drain; past the cap the quietest is dropped, which is
  inaudible, unlike the alternative.
- **Ambience** — a detuned drone pair, a wind band whose filter drifts, and
  traffic swells on their own schedule, all gated by hour and by whether you are
  indoors.

**M** mutes, **−** and **=** set the volume, and the choice is remembered.

---

## Feel

The combat maths was already fine. What was missing was every signal that tells
a player something happened.

- **Recoil** — a visual kick plus a smaller real one you have to pull back down.
  A scatter burst climbs; a pistol taps.
- **Trauma-based shake.** Stored as trauma 0..1 and applied as trauma², so a big
  event shakes **20×** a small one rather than 4×. Linear shake reads as a
  rattle at every intensity.
- **Hit-stop.** 60ms of near-frozen time on a kill, 85ms on a headshot. The
  cheapest thing in the file and the one that does the most.
- **A muzzle flash that is an actual light**, so it throws the street.
- Tracers, sparks off walls, dark bursts off bodies, a landing thump scaled by
  fall speed, and a hitmarker so "did that connect" is never a question.

---

## The bestiary — 12/12

There were three enemies and, functionally, one behaviour: walk at the player in
a straight line. Four new kinds, each defined by what it *does*:

| | behaviour | measured |
|---|---|---|
| **Stalker** | will not come at you head-on; circles and re-approaches | sweeps 835° around you, stays 4.4m off the approach line |
| **Spitter** | refuses to close; holds a lane and backs off | placed at 4m, retreated to 8.1m |
| **Howler** | barely fights; puts everything within 40m onto you through walls | 6 of 6 woken inside range, one at 300m untouched |
| **Husk** | slow, armoured, detonates on death | 5.5m blast: player −15, a thug beside it −17, one at 40m untouched |

And three things that apply to everything already in the game:

- **Flanking.** The nearest attacker takes the direct line; the rest are given a
  slot and steer into it. Six on one line become one direct, two left, three
  right, at three different widths. The steering fades out inside six metres —
  a flat lateral component all the way in turned a horde into a carousel, and
  measured five of five zombies reaching you dropping to two.
- **Calling for help.** Being shot alerts neighbours within 18m. A quiet kill is
  now a real choice.
- **Armour that faces forward.** A heavy shot in the chest takes 20 where the
  same shot in the back takes 40 and a headshot takes 40. There is now a right
  way to fight the tank.

Ranged attacks **draw their shot**. Drones have always damaged you from eighteen
metres with no visible cause.

Sieges escalate in kind as well as number — past forty kills you are facing four
types instead of one.

---

## Detail — 13/13

- **Four business types had no interior of their own.** Store, pawn, repair and
  tea got the universal counter-and-shelves and stopped. All four are furnished:
  aisles and a lit cabinet, instruments behind a grille, a bench with a job on
  it and a hoist, low tables with floor cushions and a hanging lantern.
- **Municipal street furniture** — hydrants, bollards in runs, parking meters,
  post boxes, storm grates, manholes, sandwich boards, stacked tyres, wall-
  mounted bins and alarm boxes, tarped pallets, road paint. A city reads as real
  in the gaps between the things a designer would think to place.
- **Rooflines.** Every building shared one. Now: water tanks on legs, stair
  bulkheads, cornice bands, guyed masts and lit vertical signs — 49 distinct
  signatures across 80 buildings.

---

## Loot and progression — part of the 13

- **Weapon mods, five tiers.** A rebuilt pistol does 62.4 damage against 32,
  with spread 0.014 against 0.025 and a 0.30s cooldown against 0.40s. Resolved
  in one place, so the base table is never mutated.
- **Mod kits drop from what is worth killing** — 0% off a thug, ~14% off a
  howler, ~16% off a husk — and always upgrade whichever of your weapons is
  furthest behind, so they are never dead loot. Nothing is offered once
  everything is rebuilt.
- **The Armoury sells bench work**, two cores a tier, and refuses at the
  ceiling. Tiers persist with the rest of the armoury record.
- **The Reclaimer rig finally does something.** `Shift.yieldBonus` was written
  by that upgrade and **read nowhere in the file** — three cores bought a line
  in a save. A 3-block seam now drops 6 with the rig fitted.

---

## Two bugs found on the way

**Gang camp fires have never lit.** `shMakeTrashFire(cx + 1, cz, chunk)` — the
signature is `(chunk, x, y, z, rng)`, so the chunk arrived where z was expected
and the call silently failed its own footing check. Every camp in the greenbelt
has been sitting around an unlit barrel since it was written.

**A regression I caused and caught.** Chunk generation is one deterministic RNG
stream, so a new pass that draws from it shifts every draw downstream. Adding
hydrants moved the residents — 15 became 11, and the ones near the player
disappeared entirely, which showed up as the city no longer talking to itself.
Every new pass now keys its own generator off the chunk, and there is a test
that proves the shared stream is untouched.

---

## Verified

| suite | result |
|---|---|
| sound and feel | 16 / 16 |
| the bestiary | 12 / 12 |
| detail, loot and progression | 13 / 13 |
| the front door — profile, slots, restore, recovery | 12 / 12 |
| the film cannot strand you | 5 / 5 |
| siege | 24 / 24 |
| thought bubbles | 18 / 18 |
| newswire | 16 / 16 |
| campaign playthrough to THE SECOND LIGHT | 7 / 7 |
| web beta, served as a static site | 12 / 12 |
| `_verify_story.js` (yours) | pass |

The siege suite's sinking check now proves itself on every run: it drops a body
by exactly the 1.35 units of the old shared-geometry regression and fails if it
does not notice.
