# 0.18.0 — THE MAP, THE DISTRICTS, THE DAY AFTER, AND A FILM THAT HOLDS STILL

Four things you asked for. Three of them turned out to have a measurable bug
underneath, which is the interesting part of each.

---

## The clouds were in front of the buildings

My bug, from the sky work, and a bad one. A `transparent` material goes into
three's transparent render list, which is drawn **after every opaque object
regardless of renderOrder** — and I had the cloud domes on `depthTest: false`.
So at street level the weather was painted straight over the city.

Depth testing is back on for both cloud layers and the sun disc, and the sky
dome now explicitly writes the far depth they test against. Verified by
standing two metres from a wall at noon and reading the centre pixel: it comes
back `rgb(39,39,70)`, which is a wall, not sky.

---

## The intro

I did do work on this before you saw it — and it was the wrong work, or at
least only half of it.

**What I did first.** Profiled it. During the film the simulation is paused, so
nothing is running but the renderer, and the renderer was issuing **1,093 draw
calls for 54,704 triangles** — fifty triangles a draw. Seven decorative passes
each add their own mesh per chunk, forty-nine chunks, and the film's first shot
sits sixty metres up where nothing frustum-culls. Every chunk's static
decoration is now merged into two meshes:

    draw calls   1,093 → 397

Plus warming the shaders from the film's own opening position (the first frame
measured 3.7s against a median of 1.3 — that gap was shader compilation) and
rendering the film at 65% pixel ratio.

**What I missed.** None of that addresses why it looks bad. The film spends
every frame *moving*. A continuous dolly at fifteen frames a second reads as
broken; a held composition at fifteen frames a second reads as a photograph and
nobody notices. Same cost, completely different experience.

So:

- **The camera drifts instead of flying.** Every shot's travel is cut to a
  third and the easing now decelerates hard — 88% of each move is done by the
  halfway point, so by the time there is a caption to read the camera has
  nearly stopped. Longest move is now 13m at 2.5 m/s; it was over 4 m/s.
- **The film is half as long.** Five shots, 26 seconds. Fifty seconds of
  procedural city was more than the material could carry.
- **It watches itself and gives up gracefully.** The film measures its own
  frame time, and if the machine cannot hold twenty frames a second it stops
  moving the camera at all and plays the remaining captions on a held frame. A
  slow machine gets a title sequence instead of a bad flythrough — which is the
  better film anyway. Measured: at 11 fps it holds and the camera moves 0.000m;
  at 60 fps it is left alone.

One bug found doing it: `shEase` is declared `const` at the top level of a
classic script, which puts it in the script's lexical scope and **not** on
`window` — so my first attempt to override it created a different property that
the call site never looked at, and silently changed nothing. The camera is now
placed in the wrapper after the original tick, which needs no cooperation from
anything.

**The honest caveat**: this test renderer is a software rasteriser at about one
frame a second, so I can measure structure — draw calls, travel distance, the
watchdog engaging — but not your frame times. Tell me how it actually feels.

---

---

## The map

Top right. North up, because in a city on a grid a rotating map costs you the
one thing the grid was giving you for free.

It shows the street grid, each block tinted by district, landmarks as gold
squares, doors you can open, skateparks, people, enemies, and the current job —
with an edge arrow and a distance when the job is off the edge, because that is
exactly when the marker used to vanish. **M** toggles it.

It is drawn, not sampled: everything it needs is already a pure function of
chunk coordinates, so it draws ground you have never loaded and is still
correct when you walk onto it. A chunk nine kilometres away has a colour.

---

## The districts

The district table had thirty numbers in it and not one changed the shape of
anything — heights, window colours, and the probability of a bin. Downtown was
a tall grey box with cyan windows and the Forge was a short grey box with orange
ones. Turn the lights off and they were the same street.

What tells you where you are in a real city is silhouette and what is over your
head, in that order. So:

| | |
|---|---|
| **Downtown** | towers that step in as they rise, roof masts, skybridges strung between neighbours |
| **Echo Heights** | balconies on every floor, washing strung between them, stoops, dishes |
| **The Forge** | chimney stacks, pipe runs down walls and out over the road, gantry stairs, drums, chain fence |
| **Flood Gate** | the street is under water — duckboards on stilts, sandbag walls, bollards, a tide line on every wall |
| **Night Market** | a canopy. Awnings the length of every frontage and lantern strings criss-crossing overhead |

And the pavement changes underfoot — concrete, brick, rust, board, tile. It is
the cheapest of all of these and does a surprising amount of the work, because
it is the one thing always in frame.

**The bug underneath**: `districtAtPosition` added half a chunk before dividing,
so for a third of every block the HUD named the district next door and the
generator had built the other one. Districts cannot read as distinct while the
game is telling you the wrong name for a third of the ground. 260 sample points
across every loaded chunk now name it right; before, a third did not.

---

## The story — twelve movements, not six

The campaign ended at 05:11 with the sun coming up on a case you had just
closed. That is a good night. It was not yet a story, because nothing in it
ever came back: every movement was a self-contained shift, and the one real
choice in the whole night was recorded, printed once on the end card, and never
mentioned by anybody again.

So there is now a second act — the day after, in which the night's decisions are
standing in front of you with faces on.

    7 · 06:00  THE MORNING REPORT      go and look at what your answer did
    8 · 09:20  THE SEVENTEEN OTHERS    the Vale case was not unusual
    9 · 13:00  THE FOURTEENTH          what actually happened to Ned
   10 · 17:58  THE MINUTE              one year since meaning ended
   11 · 20:40  THE AUDITOR             the Bureau sends someone to explain itself
   12 · 05:5x  THE SECOND LIGHT        four minutes, three places to put it

Three things make it a story rather than more of the same. **Choices are
recorded and spent** — decisions are written to the save and later movements
read them back. **The counterweight is right**: Auditor Vess makes the Bureau's
actual case — that discretion helps whoever is standing in front of you and the
form helps everyone else — and if she were a villain the ending would be free.
And **the ending is yours**: three of them, chosen by what you did, with the
card naming the decisions that produced it.

2,621 words of new dialogue. Act two is appended, never inserted, so a save in
progress still lands in the movement it was in.

---

## Also fixed on the way

- **Neon pools were a full block away from their signs.** They were being
  placed at `chunk.origin + building.cx`, but buildings are recorded in world
  coordinates already. This is why the prop audit kept reporting them as
  floating over nothing.
- **Four district pieces were yaw-rotated onto the wrong axis** — awnings,
  lantern strings, duckboards and a pipe elbow all ran across the thing they
  were meant to run along. The convention is now written down once at the top of
  the section, because getting it wrong is silent.
- **Flood Gate baked one box per sandbag**, about 3,500 parts a chunk. A run of
  bags is now one slab with a bag-sized ripple along its top, which reads the
  same from anywhere a person can stand.
- **The fog object was being rebuilt every frame** — a new FogExp2 and a new
  Color, sixty times a second, for the whole game.

---

## Verification

`citytest.mjs` — 14 tests, green. `filmtest.mjs` — 8 more, covering the film's
new timing, the watchdog at both ends, and the cloud depth regression. Plus sky
12, board 20, flow 6, renderer 2, beta 13 and feel 16, all still passing.

One test exists only because the screenshots misled me for an hour: **"the city
still has buildings in it"**, which measures the tallest solid block over every
district's footprint. Five badly-aimed night screenshots looked like the
district passes had eaten the world. They had not — the camera was against a
wall at ten past eight at night. The numbers settled in thirty seconds what the
pictures could not settle at all.
