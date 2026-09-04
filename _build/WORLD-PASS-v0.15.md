# v0.15 — world flow and aesthetic

You gave me a long list and said *"firstly just try and fix world flow and
aesthetic"*, so that is all this is. The arcade, the intro, the prequel and the
dialogue pass are untouched and still to come — see the end.

I measured before changing anything, and the first thing I measured turned out
to be the whole problem.

---

## The city was a grid of walls

**The player could not walk up a single one-block step.** Measured: walking
straight at a one-block rise, the player advanced 1.08 metres and stopped dead.
There was no step assist anywhere in the movement code.

Every pavement edge, every doorway threshold, every park border and every
district seam in this city is a one-block rise. So the entire place was a lattice
of low walls you had to jump over. **That is what "the entrances are wonky" and
"no flow" actually were** — not the entrances, the legs.

There is now step assist: a rise of up to 1.15 is simply walked up, from the
ground only, with headroom checked both sides, and the camera eases the lift so
a kerb reads as a stride rather than a teleport. Two blocks is still a wall,
because two blocks is a wall.

| | before | after |
|---|---|---|
| one-block kerb | advanced 1.08m, **blocked** | climbed 0.9, **walked on for 9m** |

---

## The parks really were above the ground

You were exactly right. `shGrowPark` stamped turf at y=2, so its walkable
surface was **y=3**, while every pavement in the city tops out at **y=2**. Every
greenbelt was a kerb on all four sides.

Everything the park builds — trees, fence, pond, bandstand, court — was written
against that surface, so they all came down one together, and the surface is now
named `PARK_TOP` instead of being the number 3 written out eleven times. The
basketball court is now laid *into* the turf rather than sitting on top of it.

| district ground level | before | after |
|---|---|---|
| RESIDENTIAL / NIGHT MARKET / FLOOD GATE / FORGE | 1 | 1 |
| **GREENBELT** | **2** | **1** |
| spread across the city | 3 | **0** |

---

## And a pass that smooths what is left

Even with step assist, a rise of two or three is a wall, and the generator grows
plenty of them where passes meet — a park edge against a road, a plaza rim, a
flooded kerb. A new pass walks the open ground of each finished chunk and lays
the intermediate courses so any seam is climbed one block at a time.

It is deliberately narrow: only columns with open sky above, only at street
level, and only for rises of 2–4. Most vertical faces in a city are meant to be
walls and it leaves them alone.

| | before | after |
|---|---|---|
| ground transitions needing a jump | **36** | **4** |
| walkable steps | 0 (none were walkable) | **191** |
| worst rise | 4 | 2 |

---

## Doors that look like doors

Every entrance was a hole at whatever height the floor happened to be. All
thirteen now get jambs, a lintel, a lit sill along the threshold and a number
plate — and where the floor sits two or more off its street, a graded flight
three wide, filled from below.

*(The first version of that ramp stamped from `min(sy, stepY)` to `stepY`, which
is an empty range whenever the door is below its street — precisely the case it
was written for. Doors two below stayed two below until I measured it.)*

---

## The grade

**The renderer had no tone mapping at all.** Every neon sign, lit window and
torch was clipping straight to white, which is why the city read as *bright*
rather than as *lit* — a magenta sign at close range was the same colour as a
white one.

- **ACES filmic** at exposure 1.45, rising to 1.57 after dark.
- A cool **rim light** low and behind, so figures and props separate from the
  wall behind them.
- **Fog that knows the hour** — denser after dark, and its colour still derived
  from the sky gradient, so the pink dusk survives.
- **Neon pooled on the road** under every run of signage: long soft emissive
  smears rather than discs, which is most of what makes wet asphalt read as wet.

One thing worth recording: my first attempt dropped the ambient and hemisphere
together with the new curve and crushed the whole city to near-black. Noir is
contrast, not underexposure. The curve was the thing that was missing; the light
levels only wanted a nudge.

---

## Verified

| suite | result |
|---|---|
| world flow (new) | 6 / 6 |
| siege | 24 / 24 |
| detail, loot and progression | 13 / 13 |
| campaign playthrough | 7 / 7 |
| front door | 12 / 12 |
| sound and feel | 16 / 16 |
| bestiary | 12 / 12 |
| thought bubbles | 18 / 18 |
| the Town Square | 14 / 14 |
| web beta, served as a static site | 13 / 13 |

The world-flow suite is permanent, and it asserts the numbers above so they
cannot quietly go back up.

---

## Still on your list, not done yet

- **The arcade** — lifeless, and the cabinets are badly placed.
- **The intro** — it lags, it does not flow, and there is no hook.
- **An epic prequel around The Collapse of Meaning.**
- **Humour and dialogue** — funnier, more directed.
- **More HD world elements** — this pass fixed the ground and the grade; it did
  not add much new geometry.

The prequel is the one I would want to talk about before building, because it
should probably share the Light Bearer's vocabulary rather than being a third
separate thing.
