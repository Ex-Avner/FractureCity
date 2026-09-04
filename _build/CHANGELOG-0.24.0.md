# Fracture City 0.24.0 — the opening

## The intro lag was never the intro

Section 42 went after the draw call budget. Section 49 shortened the film from
26 seconds to 12. Both helped, and neither was the bug.

`updateChunks()` had **no budget of any kind**. It walked the wanted set and
built every missing chunk synchronously in one frame — terrain, buildings,
districts, parks, skateparks, fittings, depots, shops, the greedy mesher, all of
it. Instrumented:

| | before | after |
|---|---|---|
| first frame after NEW GAME | **1,430 ms · 49 chunks** | 47 ms · 4 chunks |
| crossing a chunk boundary | 95 ms · 7 chunks | one time-budgeted slice |
| a call that built nothing | 112 ms (bulk dispose) | budgeted, 3 per call |
| total in `updateChunks` | 1,957 ms | 458 ms |

So the film opened on a frame that took a second and a half, and after that the
city hitched a tenth of a second every twenty-four metres — on foot, often; on
the skateboard at forty metres a second, **twice a second, forever**. That is
the lag. Not the sky, the clouds, the crowd or the draws. One unbounded
for-loop.

It is now a nearest-first queue with a **time** budget rather than a count —
6 ms of a frame normally, 14 ms behind a film or a menu where nothing else is
moving. A count would be either a dropped frame or a needless crawl depending on
whose computer it is; a time slice is correct on both. The chunk you are
standing in is never queued, so you can never fall through the world waiting for
a budget, and `updateChunks(true)` still drains everything synchronously for the
few callers that legitimately want a finished world.

## The Shift came back — that one was mine

Section 8 builds a twenty-minute Shift: your own door at dusk, a clock, an
objective, an end-of-day echo screen, a per-calendar-day timer so leaving and
coming back resumes the same twenty minutes rather than granting new ones. All
of it still worked.

But section 31 replaced the menu with a save-slot front door and parked the old
buttons in a `.legacy { display:none !important }` block so nothing would throw
when it reached for them by id — and **`#btn-shift` went into that block with
the rest**. The mode was never removed. The door to it was bricked up, by me, in
0.16.

It is back, with a live line underneath saying how much of today's twenty
minutes remain before you commit to it.

## The menu

- It no longer claims to be **v0.15** — eight versions stale.
- The two NEW GAME buttons were identically worded and identically weighted, and
  one of them is the story this whole project is about. The campaign one now
  says **· start here**, and all three modes have a line under them saying what
  they are.

## What do I do now

The campaign HUD listed every objective in the chapter at once, in the same
weight, several locked behind each other. What it never said is the one sentence
a player actually wants.

There is now a **NOW** line above the list naming the single next action — and
when that action is a place, how far and which way, in words that follow the
camera as you turn:

> **NOW** Leave Residence 14 for the crossroads — 118m, slightly left

Words rather than a compass rose, because "behind you" is a thing you already
know how to use.

## Ned

He was written well and he was not loveable, because irony on its own is armour
and you cannot love armour. What makes this kind of character loveable is the
moment the armour slips — one plainly sincere sentence, then he makes himself
the joke and changes the subject.

He has been reading the six o'clock to a city that stopped commissioning it in
the spring. He is not detached. He is lonely, and being funny about the Bureau
is how he gets through a shift.

So he notices you now. Five new things he reacts to — you came back, you have
stopped moving, you are badly hurt, you filed something, and one long-fuse
one-shot where he says the quiet part:

> *"Can I say something off the bulletin. You are the first thing that has moved
> on my monitors in a fortnight, and I have been reading the six o'clock to a
> city that stopped commissioning it in the spring. That is the sincere portion
> of this broadcast and it is now concluded. Coming up: a road that is still
> closed."*

And warmth folded into the pools he already had — 9 of his 55 lines now speak to
you in the first person. He still will not talk over a chapter beat, a decision
or a line of narration.

## Bugs

- **`updateDayNight` throws on any frame before a game exists.** It writes
  `State.sunLight.position` unconditionally, but the whole lighting rig is built
  inside `newGame()`. Nobody saw it because every route in built a world first —
  and the restored DAILY SHIFT button walked straight into it. Guarded, and the
  shift button now uses the original's `chunkMap.size === 0` check rather than a
  flag, which is what that check was always for.

## A measurement I threw away

I built an A/B frame-time harness for the streaming fix and it reported a median
frame of **947 ms before and 716 ms after** — which is not a 25% improvement, it
is a software rasteriser taking a second a frame regardless of what the code
does. Earlier in this project I wrote down the rule "swiftshader runs at ~1 fps,
measure structure, never wall-clock", and then built exactly the thing that rule
forbids.

The honest measurement is the structural one at the top of this file: how long
`updateChunks` holds the main thread, and how many chunks one call builds. Those
numbers are real and they are the ones quoted.

## Suites

`flowtest2` 13 · `fittest` 13 · `depottest` 10 · `squaretest` 10 ·
`touchtest` 13 · `betabuildtest` 9 — 68 checks, all passing.

The suites' world sweeps now call `updateChunks(true)`. They used to rely on one
call loading everything, which is precisely what stopped being true — a test
that assumed the bug is a test that fails when you fix it.
