# Fracture City 0.25.0 — the transmission, and three beta blockers

## The intro: a new approach, because trimming it was never going to work

Three passes have now been made at the opening film. Section 32 got the camera
out of the walls. Section 46 stopped it moving when it could not move well.
Section 49 cut it from 26 seconds to 12. It has been reported as broken every
single time, and the reason is structural:

**The opening film renders the city.** It is a camera flying through a world
that is being generated underneath it, on the one frame budget the game has, at
the exact moment the machine has least to spare. A cinematic that competes with
streaming for the main thread will always be the worst-looking thirty seconds in
the product.

So this one does not render the city at all.

It is a **transmission**. Black screen, a signal, and a man talking directly to
you — not to the player character, to *you*, the person holding the phone. That
is not a gimmick bolted on for novelty; it is the premise the game already has.
Ned has been reading the evening news to a city with nobody in it for eleven
months. The most dramatic thing that can happen to that man is somebody
switching on.

```
  > fracture city news network
  > evening bulletin · 18:00 · transmitting
  > audience: 0

  NED  Good evening, Fracture City. It is six o'clock, and shared
       meaning ended at 17:58. Municipal services remain unaffected.

  > audience: 0

  NED  That is the eleventh month of that. I read it out anyway,
       because it is on the sheet, and because the alternative is
       silence and I have tried silence.

  > audience: 1                                          ← the screen flashes

  NED  …
  NED  I am going to keep looking at that number for a moment,
       if nobody minds.

  —    Somebody is receiving this.

  NED  Somebody is receiving this. Hello.
```

From there he stops broadcasting and starts speaking — the type changes colour
when he does — lays out the case in plain words (**Marcus, Clara, one answer
field, before midnight**), and signs off with *"Try not to die; the paperwork is
appalling."*

What it buys, mechanically: **0 draw calls, no scene, no camera.** It cannot
stutter, and section 57 drains the chunk queue at 14ms a frame while it is up,
so the city finishes building *behind* it instead of underneath it. One press
completes a line, two presses inside a second skip the whole thing.

## The mobile freeze

Reported as *"click E or any pop-up and it freezes up entirely"*. It was a
z-index fault in section 56 that I should have caught by reading the stylesheet
instead of trusting my own busy-list:

```
  #touch-layer   z-index 58
  #inv-overlay   z-index 58   ← a tie, broken by DOM order, which my layer
                                wins because it is appended last
  #chapter-card  z-index 52   ← straightforwardly underneath
```

`#tc-look` was a full-screen div with `pointer-events:auto`. Nothing was frozen.
Everything was **buried** — the inventory and every panel opened under an
invisible sheet that ate the taps.

Section 56 tried to handle this with a hand-maintained list of "a panel is up"
flags, which can only ever be as complete as my memory of a 24,000-line file.
The fix is not another entry on that list:

- **Looking moved onto the renderer canvas**, which sits below every panel in
  the game by construction. A panel can never be buried by it.
- **The controls dropped to z-index 40**, beneath every overlay, so a full-screen
  panel covers them and takes the taps itself.

Verified against the real elements: layer at z40, all five panels above it, and
a tap on an open inventory or shift panel now lands on the button.

## The Fourth Watch stops being a diorama

*"Remove the Fourth Watch block — it looks cheesy and I don't want the climax of
my book just sitting out as a prop in the town center."*

Both halves of that are right and they point at different fixes. The chunk one
square from the crossroads was a flooded block with a stepping-stone ridge, four
lamp posts and a silent child, permanently on display to anyone who walked two
minutes the wrong way. It is also **the sixth movement** — the last chapter of
the campaign. Deleting it deletes the ending.

So it is not deleted. It **stops existing until the story arrives at it.** Until
chapter six the block is ordinary flooded street with a plain causeway across
it; the moment the sixth movement opens, the chunk is evicted and rebuilt with
the crossing, the lamps and the witness in place.

A climax should be somewhere you are taken, not somewhere you find early and
wonder about.

The causeway gets **ramps at both ends** — it sits at y=3 and the street at y=1,
so a bare slab would have been a two-block wall, the exact fault this city has
been audited for twice. Measured across the block: biggest step 1, no holes.

## The horde

*"The zombie waves mode is too weak, not enough zombies."*

It was ten on the street at once rising to twenty-six, **one** arriving every 2.2
seconds falling to 0.55. That is not a siege, it is a queue.

| | before | after |
|---|---|---|
| alive at once, start | 10 | **20** |
| alive at once, ceiling | 26 | **64** |
| between arrivals | 2.2s → 0.55s | 1.5s → **0.34s** |
| per arrival | 1 | **2 → 6** |
| speed | 2.5 | 3.1 |

They arrive in **groups** now — a wave is a wave because several come over the
kerb at once; one every two seconds is a leak. They are still individually weak,
which was the right call: the horde only works if any single one of them is
never the problem.

The old cap existed because "past a certain number the frame rate is the
difficulty rather than the design" — true when `updateChunks` could spend
1,430ms on one frame. Section 57 gave the frame its budget back, so the cap goes
where it always should have been.

## Where I wasted an hour

The test suite for this, first time round, called `updateChunks(true)` (49
chunks, ~1.5s each under software rendering) and used wall-clock waits to drive
a cutscene that auto-advances. Every test took 120 seconds, then the browser tab
crashed outright.

Rewritten to be surgical — build the **one** chunk under test, drive the
transmission synchronously with its auto-advance pinned — the same suite runs in
**six seconds**.

Two of my own tests were also wrong in ways worth recording:

- The freeze probe used the **chapter card**, which is `pointer-events:none` by
  design. It was never the thing being blocked, and the probe reported "CANVAS
  is on top" and looked like a failure. The panels a player actually taps are
  the inventory and the shift panel.
- The crossable-block probe scanned `cx*24`, but a chunk's centre is
  `cx*24 + 12`. It was measuring the next block along, and then measuring across
  a chunk boundary into unbuilt neighbours and calling the air a hole.

## Suites

`betaA` 9 · `betaB` 7 · `flowtest2` 13 · `fittest` 13 · `depottest` 10 ·
`squaretest` 10 · `touchtest` 13 · `betabuildtest` 9 — **84 checks, all
passing.**
