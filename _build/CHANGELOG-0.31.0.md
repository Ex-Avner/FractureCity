# Still Human // Wild 0.3.0 · a valley, not a field

Nine times the ground, seven settlements, and something to do in it. The city
file is untouched this release; `SH_VERSION` moves to `0.31.0` only because the
hosted build compiles this engine into itself, so the shipped artifact changed.

## What blocked it, before anything was built

Three things in the engine made "bigger" impossible rather than slow.

**Nothing streamed.** `buildWorld()` built the entire world once and kept it
resident: 100 tile meshes, 51,200 triangles. At 3x that is 900 meshes and
460,800 triangles, and a tile mesh is one draw call.

**The Kiln was welded to the origin.** `baseHeight()` flattened a plateau at
(0,0), and `keepR()`, spawn exclusion, the mob push-out, base regen and the
sculpt and build refusals all asked `hypot(x, z)` from world centre.

**Saves keyed terrain edits by a flat index** into a `(GRID+1)²` array, so
changing the world size moved every edit somewhere else.

## Streaming

576m across, 480 cells, 400 tiles of 28.8m. Tiles build within 144m of the
player, nearest first, three per frame, and are let go past 202m with
hysteresis between the two radii so walking a boundary does not thrash.

The heightfield stays fully resident: 481 x 481 floats twice over is 1.85MB,
and having it everywhere is what lets the map, the minimap and the settlement
placer ask about ground that has never been drawn.

Props are **data for the whole world and instances only for what is near**.
Four thousand trees drawn at once is 160,000 triangles that no frustum test can
help with, because an `InstancedMesh` is one object as far as culling is
concerned. The arrays hold everything; the instance buffers hold a window,
rewritten on a tile crossing, filled nearest-tile-first so an overrun drops the
far side of the window rather than whatever a row-major scan reached last.

One coarse mesh of the entire world at quarter resolution, sunk 1.5m so real
tiles always win, gives a horizon past the streaming radius for one draw call
and 28,800 triangles. Day fog now reaches 420m on purpose: the point of a
bigger world is seeing somewhere before you walk to it.

Measured in the window: **187 draw objects, ~183,000 triangles**, steady
whether you are at the Kiln or 300m away at the rim.

## The world shape had to be rebuilt

The ridge mask was radial and tuned for 192m, so at 576m everything past 96m
from centre was a peak: the first 3x world came out 3,400 boulders and 416
trees, with the scatter starved because almost nothing qualified as plains.

Mountains are **regions** now, not a ring: a low-frequency massif field decides
where a range may be, ridged noise shapes it.

And the thresholds are **calibrated per world, not fixed**. A value-noise fBm
does not have the same mean on every seed, so a constant threshold produced
worlds anywhere from 30% plains to 93% plains. Both mask fields are sampled on
a 64 x 64 grid at world-gen and the thresholds taken as percentiles of what
that seed actually produced. Across seeds now: **74-80% plains, 5-7% foothill,
4-7% rock, 7-15% snow**, with peaks around 80m.

The colour bands moved with it. A snow line at 23m against 80m peaks turned
every range into a white blob with a nine-metre rim of anything else.

## Seven kilns

One home Kiln, two living settlements, four ruins. Placed on a jittered ring
118m to 230m out, each with its own flattened plateau, and their floor heights
sampled from the raw land *before* the flatten, or the flatten would be defined
in terms of itself.

Every protection rule goes through `nearestSettlement()` and `siteBlocked()`
now: every lit ring holds monsters out, pushes them back, mends you inside it,
and refuses the spade and the crowbar. An unclaimed ruin holds nothing, which
is the whole reason to go and relight one.

A settlement is one merged solid mesh and a handful of glowing ones. Six towns
of fifteen separate boxes each would be ninety draw calls before a single tree.

**Ruins hold a blight**: monsters that do not burn at dawn, so a ruin can be
cleared in daylight rather than only being a night problem you cannot schedule.
Clear it, feed the kiln 18 ember, 45 timber and 45 stone, and the ring, the
bench and the safe ground are yours.

## Work

A chain of nine objectives that names the next thing, marks it on the map and
pays on completion, from living through the first night to relighting every
kiln in the valley. A contract board at every lit settlement, three at a time,
rerolled on turn-in: gather, hunt after dark, hold a night without going down.
Three in hand at once.

## Knowing where you are

At 192m you could see the Kiln from anywhere. A compass strip along the top
carries the five nearest bearings with distances, spaced so two names cannot
sit on top of each other. **M** opens a full map: drag to pan, wheel to zoom,
every settlement labelled and marked lit or unlit, click a name to set a
marker. The corner minimap is a 190m window on the same baked image rather than
the whole world in 84 pixels.

## Saves

**v2**, keyed by cell coordinates rather than a flat index, so this is the last
time the format breaks. It carries which kilns are lit and what still holds the
rest, your place in the chain, the contracts in hand, the Kiln's upgrades, your
tools and your kit. The v1 key is left alone on disk rather than overwritten.

## Also fixed on the way

* The third-person camera clipped into town buildings. Trees and boulders were
  handled; buildings were not, and a town is the one place you are guaranteed
  to be surrounded.
* A short plateau blend made an apron steep enough to trip the slope-to-rock
  rule, ringing every settlement in grey scree.
* The minimap stretched the baked image's edge pixels into a grey band wherever
  its window overhung the world.
* Settlements could land on snow shoulders above the tree line.
* A dead kiln read as a black lump at dusk.
