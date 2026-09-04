# Fracture City 0.25.1 — the freeze, found in the render loop

*"The new intro is dope but it froze almost immediately."*

It was not the transmission. It was three lines at the top of the game loop,
and they have been there the whole time.

## `tick()` forks itself while an intro is up

```js
function tick(){
  requestAnimationFrame(tick);                                    // (1)
  const dt = Math.min(0.05, State.clock.getDelta());
  shTickDialogue(dt);
  if (State.ui.inIntro){ requestAnimationFrame(tick); return; }   // (2)
```

Every frame that an intro is up schedules **two** ticks. Two become four, four
become eight. Ten seconds in, the tab is doing nothing but re-queueing itself.

Measured, with the transmission up:

| | before | after |
|---|---|---|
| worst gap between animation frames | **7,425 ms** | 1,134 ms |
| calls to `updateChunks` in 15s | **0** | 26 |
| chunks loaded / still queued | 14 / 35 | **49 / 0** |

Nothing ran inside that seven-second frame. Not the streamer, not the HUD, not
the renderer — the whole budget went to the fork bomb.

This is the lag that has been reported against the opening in **four** separate
versions. Section 32 moved the camera out of the walls. Section 42 cut the draw
calls. Section 49 shortened the film from 26 seconds to 12. Section 57 gave the
chunk streamer a per-frame budget. Four passes at "the intro is laggy", and not
one of them read the first three lines of the loop.

The fix is one rule applied globally rather than a patch to the one path I was
looking at: **at most one pending tick, ever.** `requestAnimationFrame` is
wrapped so a second scheduling of `tick` while one is already in flight is
dropped. Every path that sets `inIntro` — this transmission, the old cold open,
whatever a later chapter does — is covered.

## The transmission ran on frames, not on the clock

The other half. The tick advanced on `dt` with the standard clamp:

```js
const dt = Math.min(0.05, (now - last) / 1000);
```

Correct for physics — a long frame must not teleport the player through a wall
— and wrong for a cutscene, where it means **no frame may advance the film by
more than 50ms no matter how long it really took.** The probe caught it exactly:

```
t+2s  line 0  typed 26/26  hold 0.59  active true
t+4s  line 0  typed 26/26  hold 0.49  active true
t+6s  line 0  typed 26/26  hold 0.44  active true
```

Not frozen. Running at a twelfth of real time, on a line worth 1.2 seconds.

And the frames were long *because the intro was working*: section 57 hands the
streamer its generous budget precisely while a film is up, so the transmission
slowed down in proportion to how well it was covering the city build.

Nothing accumulates now. Each line records the wall-clock millisecond it began;
the typing and the advance are both read off `performance.now()` against that. A
machine at four frames a second plays this at the same speed as one at 144 — it
just draws it in bigger steps. The overshoot is deliberately *not* carried into
the next line, so a stall makes the transmission run slightly long rather than
fast-forwarding through the man talking.

The old cold open's own comment, from months ago, says: *"A film runs on a
clock, not on frames… Wall clock, always."* I wrote the replacement on a dt
accumulator.

## Two more things it turned up

**The sim was standing down for a film that draws nothing.** `State.ui.inIntro`
means "the film owns the frame" — true of the old cold open, which drove its own
camera and drew its own frames, and false of a black screen with type on it.
With the flag set, the city does not build behind the transmission at all; it
builds in the first ten seconds of play, which is the exact hitch this section
exists to move. The flag stays off, the sim runs, and the **input is swallowed
at the capture phase instead** — so nobody walks off during a broadcast they
cannot see past, and the city is finished before Ned signs off.

**The city was being drawn behind an opaque sheet.** `#trans` is `inset:0` on
`#05040a` at full opacity, and the main loop's `render()` does not know the
screen is covered. The 0.25.0 changelog claimed "0 draw calls, no scene, no
camera" — true of the transmission, false of the frame it lives in. It now
renders twice a second while the transmission is up. Not never: the first render
after a new game is where the renderer compiles every shader variant, and
skipping it entirely would move that cost onto the first frame the player
actually sees.

Also: the transmission now ticks from **two** clocks — the animation frame and a
50ms interval — because a phone behind a full-screen overlay can suspend the
first. Ticking twice is free now that the tick reads the clock instead of
accumulating; two ticks in one frame produce the same character count as one.
That safety is exactly what the dt version did not have.

## Suites

`betaA` **12** (three new: real time through a one-second frame, the loop cannot
fork itself, the sim keeps running behind it) · `betaB` 7 · `flowtest2` 13 ·
`fittest` 13 · `depottest` 10 · `squaretest` 10 · `touchtest` 13 ·
`betabuildtest` 9 — **87 checks, all passing.**
