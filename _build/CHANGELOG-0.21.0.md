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
