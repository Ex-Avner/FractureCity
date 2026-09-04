# Fracture City 0.21.0 — fittings, salvage, and the requisition

## The question

*"What does Minecraft have that allows for the depth of detail we are missing?"*

Not content. **One primitive: a block that carries state.**

A Minecraft chest is a block id plus an inventory. A furnace is a block id plus
a burn timer. A door is a block id plus an open bit and a hinge side. Every
piece of depth in that game — every container, every mechanism, every thing
worth walking over to — is a coordinate with something attached to it.

Fracture City had nowhere to attach anything. `EDITS` is `"x,y,z" → one
integer`. There is no field for *what is inside* or *is it open*. So the world
was full of surfaces and empty of objects, and `E` dispatched against a
hand-maintained list of exactly four things: landmark, person, terminal, car.

The three structural pieces, in order of how much they matter:

1. **Block entities.** State attached to a coordinate. This is the one that
   makes doors, chests and treasure possible *at all*.
2. **Block states.** A Minecraft door is not eight block types, it is one type
   with facing/open/hinge/half bits. That is how you get visual richness without
   a combinatorial explosion of ids.
3. **One universal verb.** Right-click dispatches to whatever block you are
   looking at. The player learns one thing and the whole world becomes
   uniformly touchable.

And the piece that was **already here, and is the hard one**: `world =
f(citySeed) + EDITS`. Deterministic generation plus a sparse diff. Everything
below is built on that and copies its shape.

## The observation that mattered more

**The density is already here and nobody can touch it.**

Eleven district passes scatter awnings, lantern strings, duckboards, stalls and
pipework across every chunk — and then `shBakeParts` merges them into two meshes
and each of those objects stops being an object. It is vertices. The city does
not need more detail authored; it needs the detail it has made **addressable**.

## What is in 0.21.0

### 51 · Fittings — the block-entity layer

Real blocks in the voxel array, so collision, targeting, meshing and mining all
work for free. State kept the same way the world is kept:

```
fitting  = f(position)     ← what it is, what is in it
FIT_STATE                  ← opened? looted? door ajar?
```

Only the **diff** is stored. A city's worth of containers costs nothing until
somebody opens one. It is also, incidentally, the shape that makes this
multiplayer-able later — same reason `EDITS` was.

- **Doors** that open and close, remember which, and never write to `EDITS` (a
  door recorded as a block edit would be a permanent hole in a saved city).
- **Doorways carve the room behind them.** A door onto a facade is worse than no
  door. 3×3×3, floored, lit, with something in the back worth the walk.
- **`E` became one verb.** Look at a thing, press E. The old proximity list still
  runs underneath, so people, terminals and cars behave exactly as before — and
  dialogue still gets E first, so Ned is never interrupted by a locker.

Measured: **100 fittings across 50 chunks**, 17 doors, all 17 opening into an
enclosed room with a container in it.

### 52 · Salvage — the futuristic city objects

The existing economy was closed: break concrete, get concrete, place concrete.
Nothing you dug out of the city could become anything but more city, so there
was no reason to open a locker.

Ten **components** — capacitor cells, servo units, coolant cells, sign ballast,
ID lanyards, transit tokens, optic coil, ration chits, and two rare ones: the
**Bureau Seal** and the **Arc Core**. They cannot be placed. They exist to become
weapons and upgrades.

Loot is **rolled from the coordinate**, not stored. The locker on that corner of
the Forge has always held exactly what it holds, and will hold the same thing in
a fresh install of the same seed. What gets written down is one bit: you took it.

Containers are district-specific, which does double duty on the "districts should
be more distinct" work — the Forge keeps its tools in crates, Downtown keeps
everything in filing cabinets, and the Night Market keeps it in a machine that
wants money for it.

### 53 · The requisition — where salvage becomes something

A crafting bench, and deliberately **not** a 3×3 grid. This city runs on
paperwork, so you do not *make* a weapon here, you **file for one**. The bench is
a Bureau requisition form: a schedule of parts, a form number, and a stamp that
says the thing now exists — which is how everything else in Fracture City comes
to be true.

Ten filings. Every effect lands on a variable the game **already had**:

| Form | Issue | Effect |
|---|---|---|
| 14-B | Arc Baton | `WEAPONS.baton.dmg` 28 → 48 |
| 14-C | Rail Pistol | dmg 32 → 50, magazine 14 → 20 |
| 14-D | Breach Gun | dmg 14 → 22, 6 → 7 pellets |
| 09-A | Expanded Tank | `Board.fuelMax` 100 → 150 |
| 09-C | Sealed Bearings | `BOARD.fuelGrind` 17 → 26 |
| 22-A | Frame Plating | `Player.hpMax` 100 → 150 |
| 31-F | Cutter Head | mining rate ×1.7 |
| 31-K | Survey Scanner | marks unlooted fittings through walls |
| 01-A | Bureau Override | every container rolls one extra draw |
| 00-X | Arc Conversion | `Player.damageMult` ×1.35 |

Nothing here is a number that only matters to itself.

## Bugs found on the way

- **Twelve of the first eighty-three fittings were buried.** Placement hooked
  `placeSidewalkDetails`, which runs during `generate()` — but parks, cars,
  street detail, ground easing and entrance cutting all run *later* in
  `shRunPendingDetail`. A locker the world had paved over. Placement now goes
  last in that chain, which also lets it use ordinary `setBlock` and get the
  remesh bookkeeping for free.
- **Seven doors in ten were being rejected**, because the ground scan looked for
  "solid with air above" *at the facade coordinate* — and a wall is solid all the
  way to the roof, so that test can only ever succeed at the parapet. The step
  you walk up is outside the door. Reading it there took doors from 11 to 21.
- **Four rooms were carved into buildings with no ceiling** — a notch in the
  roofline with the sky in it. The ceiling is now surveyed *before* anything is
  cut, because a carve that turns out to be wrong cannot be taken back.
- **Regenerating the city raced the save.** `newGame()` cleared fitting state and
  re-read it asynchronously; rebuild the seed you are standing in and every door
  you had opened was shut again if the read had not landed. Loading is now
  guarded by *which city it was loaded for*. Same fix applied to upgrades.
- **Loading a save silently emptied your inventory.** `shSlotRestore` did
  `Inventory.set(s.slice(0,i), ...)` — a **string** key — where every other path
  in the game uses **number** keys. `shInvCount(B_CONCRETE)` read 0 while the map
  held `'3' → 40`. Pre-existing, and it matters much more now that recipes spend
  from that inventory. Fixed.

## A test that was lying to me

`a doorway has a room behind it` asked for three clear blocks on *some* side of
the door — which **the street satisfies**. It passed 21/21 while telling me
nothing, and it sent a screenshot script out to photograph the road.

A room is distinguished from a street by having a **ceiling** on it. Asking for
that dropped it to 17/21 and exposed the four unroofed carves above. Same lesson
as the district audit that flagged 38%: a test that passes everything is not
evidence, and the shape of the assertion matters more than the count.

`fittest.mjs` — 13 checks, all passing, including that the same seed regenerates
identical fittings in every chunk built twice, and that the city still has
buildings in it.

---

# 0.22.0 — depots

Sections 51–53 gave the city objects, contents and a sink. What they did not
give it is a **map**: every locker was as good as every other locker, so there
was nowhere in particular to go, and the two rare components sat at 1–3% of a
table you had to grind.

A **depot** is three things at once:

- **A destination.** Bigger inside than anything else in the city, lit, with
  three stores along the back wall and a loot table where seals and cores are
  not a rounding error — **254c average against a locker's 87c**.
- **A gate.** The door is sealed. It wants an **ID lanyard** — which until now
  was something you melted for 12 credits — or the **Bureau Override**, which is
  exactly what a clearance should buy.
- **A reason.** Every lanyard you find is now a depot you can open, and Form
  01-A stops being a stat and becomes a key to the city.

Roughly **one chunk in eighteen**. With Form 31-K filed, the scanner marks them
at sixty metres — red while sealed, green once you are in.

The primitive did not need extending to carry any of this. One more flag on the
same per-coordinate state, and depots use their own RNG stream so adding them
moved not one existing locker.

## Bugs found

- **Closing a sealed door replaced it with an ordinary one.** `shDoorToggle`
  hardcoded `B_DOOR` when putting the leaf back, so the way past every depot in
  the city was to open it once with a lanyard and shut it again. It now restores
  the leaf that was actually there.
- **A depot you left open came back shut.** The state replay asked for
  `f.id === B_DOOR`, which quietly excluded sealed doors — and depots are placed
  after the base pass has already replayed, so their doors were never replayed
  at all.
- **All three stores were landing on one square** for half the door orientations.
  The width axis is whichever one the door's normal is *not* on, and I had the
  `x` case right and the `z` case wrong.

## The one worth writing down

Depots generated at **1 chunk in 56** — too rare to ever find. I guessed twice
at why and was wrong both times:

1. *"The survey demands solid fill and these buildings might be hollow."*
   Rewrote it to check for an enclosing shell instead. **No change.**
2. *"The shell check wants solid walls at fixed distances, but a hollow
   building's far wall isn't there."* Rewrote it as a footprint-containment
   test. **No change.**

Then I instrumented the gates instead of theorising, and the answer was not in
the survey at all: **4 rejections out of 5 were at the size check.** The city's
building footprints are 4.9×4.9, 5.1×11 and 11×5.1. There is barely a square
building in Fracture City — it is a city of slabs — and I had demanded 7×7.

The room now **sizes itself** to the slab it is going into, between 3×3 and 5×4.
Depots went from 1-in-56 chunks to **1-in-18**, with 60% of offered chunks
finding room. Two of the three in the sample are 3×4; one is the full 5×4.

Both survey rewrites were still worth keeping — they are correct, and the second
one is what stops a cut coming out on the street. But neither was the bug, and
twenty minutes of instrumentation would have been cheaper than either.

`depottest.mjs` — 10 checks. `fittest.mjs` — 13 checks. All passing.
