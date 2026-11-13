# Street fabric, window panes, phone sheet · 0.102

Three modules. Each loads after everything it touches and switches off without a reload.

## What was wrong

- A street was a carriageway with one block-wide cream stripe, a metre off the centreline. No crossings, no stop lines, nothing at the kerb beyond two lamps.
- Lit and dark panes were flat single-colour cubes. Every tower read as a checkerboard.
- The phone menu covered the whole screen with about forty identical buttons. In landscape the heading took 40% of the height and eight rows fitted.
- The ability button on a phone was labelled with a keyboard letter.

## street-fabric.js · `FCStreetFabric`

Road: double yellow centre line (each block paints its own half, the neighbour paints the other), kerbside parking line, zebra crossings at every block end, stop bars and lane arrows on the approach side for right-hand traffic, manholes, drain grates, utility covers, asphalt patches, cracks, oil, puddles.

Kerb: street trees in grated pits (density follows the district's `treeProb`; one block in five is autumn), benches, bins, hydrants, parking meters, bike racks, planters, news boxes, mailboxes, bollards, an occasional bus shelter with its BUS bay. Tactile paving at each crossing landing.

Corners: traffic signals with mast arms, pedestrian heads and street-name blades, on the two corners the lamp kit leaves empty. Each intersection gets two lamps and two signals.

Lane: parked cars parallel to the kerb, inside the parking line. Sedan, hatch, van, pickup.

Roofs: water tanks, condenser rows, antenna masts with a red obstruction light.

Rules it keeps:

- Three meshes per chunk (solid, glow, decal), three shared materials, one 1024 px canvas atlas, no lights, no downloads, no per-frame work. A 250 ms tick handles dirty chunks and distance culling: 52 m Performance, 96 m Balanced, 140 m above.
- Every object records its support voxel. Mine the paving or roof under it and the object and its collider go. District paving passes that re-skin the pad after generation do not remove anything: support means solid below, air above.
- Placement runs on its own seeded stream keyed by chunk coordinates, so `chunk.rng`, the voxel field and saved edits are untouched. Online, every player sees the same street.
- Nothing is placed within reach of a door block, an `SH_HOTSPOTS` entry, a lamp, a terminal or an existing prop. Kerb objects stay within 1.3 m of the kerb.
- The `B_PAINT` lane stripe is no longer stamped at road level during generation. The block type itself is unchanged, so player builds that use paint are unaffected.

`FCStreetFabric.set(false)` hides it. `FCStreetFabric.count()` reports what is standing.

## window-panes.js · `FCWindowPanes`

A fragment-shader addition to the two voxel materials, chained after the existing surface patch. Frames, a mullion or sash rail chosen per window, lit rooms of unequal brightness (mostly warm, a fifth cool, some with blinds part-drawn), dark panes with a sky gradient, a reflection streak and sometimes curtains. Detail fades between 45 m and 110 m. No geometry, no textures. If the voxel shader is not the one it expects, it logs once and leaves panes flat. `FCWindowPanes.set(false)` restores flat panes.

## phone-sheet.js · `FCPhoneSheet`

- Portrait: bottom sheet, at most 84% of the height. Landscape: right-hand panel, at most 56% of the width. The street stays visible in both.
- Four large tiles on top: Map, Inventory, Build, Online.
- Recent: the last four rows opened, stored in `localStorage` (`fc-mob-recent`), this device only.
- Find: a filter field. Enter runs the first match. Key events in the field do not reach the game.
- Rows whose target is not on screen (the two invitation rows, Inbox) are left out until it is.
- Dismiss by tapping outside, the Close button, or dragging the handle down.
- Press feedback on every touch control; a short vibration where the browser supports it (not iOS Safari).
- Tiles and chips press the original menu buttons, so every handler in `mobile.js` is the one that runs.

`mobile.js`: the ability button shows the ability name without the `Q`.

## Limits

- Parked cars added here are scenery with collision. They cannot be driven or broken into. The original interactive cars are unchanged, including their nose-in parking.
- Signals do not cycle. Each head is fixed red or green.
- Trees do not sway and do not change with the daily hue beyond scene lighting.
- No traffic, no pedestrians using the crossings. NPC routing was not changed and does not know about the new colliders.
- Frame cost was not measured on a GPU. The test machine renders in software at under 2 fps with or without this pass, which says nothing either way. The addition is three draw calls per block and, across the 14 city blocks in the test, 3,400 triangles a block on average and 5,241 at peak. Parked cars are the largest share. Needs a real run on the M1 and on a phone.
- Verified in Chrome emulation only. No physical phone.

## Verification

- `node _test/street-fabric.test.cjs`: fabric on city blocks; mesh, light and triangle budgets; stripe retired; support and doorway clearance; pavement strip; determinism; mining removes object and collider; off switch; pane patch on both materials; phone sheet geometry, tiles, filter, recents, 44 px targets and key isolation in portrait and landscape.
- `node _test/reality-shots.cjs <tag> [desktop|phone]`: comparison frames into `_test/out/`.

Deploy `index.html`, `mobile.js` and the three new scripts together. Changed scripts use the 0.102.0 cache version. A GitHub push alone does not redeploy the hosted server.
