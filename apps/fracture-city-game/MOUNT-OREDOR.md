# Mount Oredor · 0.109

The first mission. Walk north out of the city toward the peak on the horizon. The trailhead is at X 0 / Z 300.

## The climb

| Stage | Where | Feet (y) | Readout |
| --- | --- | --- | --- |
| Trailhead and base camp | 0, 312 | 3 | 1,900 m |
| The Fear Slopes | switchbacks, z 330 to 404 | 4 to 22 | |
| Camp I · The Ledger | -30, 416 | 24 | 3,620 m |
| First rope | 35, 446 | 30 to 38 | |
| Camp II · The Cloud Line | -20, 490 | 46 | 5,770 m |
| Second rope | 10, 526 | 50 to 55 | |
| The ridge | z 533 to 600 | 55 to 61 | |
| Summit | 8, 606 | 61 | 7,840 m |

- **Ropes.** Two vertical faces. Hold W against the face to climb, S to slide down, release to hang. A jump does not clear them. Double jump is off everywhere on the mountain.
- **The feed.** About 90 posts hang over the approach and lower slopes in one instanced draw. Thick at the foot, thinning with height, none above y 45.
- **Posted fears.** Five fear posts on the lower slopes. Walk within 26 m and the fear walks out of its post onto the nearest trail. Kill it and the post goes dark, permanently for that world. Peaceful mode makes them wander and not attack. They follow the slope. They are not required.
- **Whiteout.** Fog turns white from y 39, thickest around Camp II, clears by y 54. The painted peak (`mount-oredor.js`) mists out from y 34 and is hidden above y 44.5. Above the cloud a cloud deck lies below you. The altitude readout jumps through the whiteout: 60 m of voxels read as 1,900 to 7,840 m.
- **Ridge.** Two blocks wide, drops of five or more each side, gusts from the side every 5 to 9 s, a fixed line along the east lip. Fall more than 4.5 m off the ridge and the line catches you: fade, back on the ridge.
- **Summit.** The shard hangs over a mirror-glass plinth. E takes it: white flash, the cloud deck parts, title card SIGHT. Then E descends by the fixed lines to the trailhead.
- **Camps.** Reaching Camp I or II is saved. The stake at base camp (2.5, 318) clips you up to the highest camp reached.

## Sight

Earned on the summit. `FCOredor.sight` is true; the event `fc-oredor-sight` fires once.

- Every feed post shows its author and date.
- Four posted realities stand on the mountain: a vending machine at base camp, a bus stop at Camp I, a front door at Camp II, a streetlamp on the ridge. With Sight each shows a gold seam outline and a label: who posted it, when, what they typed.

Sight in the city is not built. Other systems can read `FCOredor.sight` or listen for the event.

## Canon to decide

All words live in `CANON` at the top of `oredor-ascent.js`: camp names, the twelve posts, the five fears, the four patches, handles, dates, prompt lines. Every one is provisional. Nothing else depends on them.

Not confirmed with the owner: the altitude figures, the camp names, the fear texts, whether fears should be required, whether Sight persists per world seed (it does now, like First Signal).

## Technical

- `oredor-ascent.js`, loaded after `mount-oredor.js`. Zone: x -144 to 144, z 288 to 720 (chunks cx -6..5, cz 12..29), the same for every seed.
- `outer-expanse.js`: `region()` returns null inside the zone, so no biome, monument, discovery toast or echo stone appears on the mountain.
- `mount-oredor.js`: honours `FCOredor.hold` (hide) and `FCOredor.mist` (haze floor), set by the ascent.
- Terrain is ordinary voxels, ordinary collision, mining and edits. One 288 × 432 heightmap is computed once (150 ms on the M1, 290 ms headless): a profile along Z, terraced in 3-block bands (two blocks is a wall), trail carved through it with talus on the downhill side, then a priority flood from the zone edge so no column is a pit you cannot walk out of. The flood leaves every trail cell unchanged (checked).
- Blocks 190 to 196: granite (hardness 6), scree, firn, blue ice, feed silt, trail blaze, mirror glass.
- Air uses `FCRealLight.zones`. Fears are `Enemy` instances of type `posted-fear` with their own update; they leave `State.enemies` when you are 70 m away.
- Save: `localStorage` key `fc-oredor-v1:<seed>`. `{seen, camp, sight, quelled}`.
- Debug: `FCOredor.ascent.debug.goto(0..3)`, `.take()`, `.reset()`, `.grid`.

## Tests

`node _test/oredor-ascent.test.cjs` (Playwright, headless). Checks: grid, 1,092 trail samples walkable on built voxels, both ropes climbed by hand with stepped physics, jump cannot clear a face, double jump off, a fear spawns on its ground and is recorded when killed, camps record, the stake clips up, the ridge catches a fall, the shard grants Sight and fires the event, shard and halo hidden after, descent, no page errors. Screenshots to `_test/out/oredor-*.png`. `NO_SHOTS=1` skips them.

## Measured on the owner's M1 (25 Nov)

Injected into the public Netlify build in the desktop app's built-in browser, the exact files verified by checksum. Metal renderer. Timing by direct render with a forced 1-pixel readPixels, because the hidden pane throttles rAF.

- Overlays (feed, props, cloud deck): 0.14 to 0.27 ms per frame.
- Ultra, 2048 × 1536, normal streaming: city street 37 ms, high view over the city 49 ms, Fear Slopes 28 ms, Camp II 26 ms, ridge 23 ms, summit looking down 18 ms. The mountain is cheaper than the city.
- Chunk build: mountain 2.9 ms, city 3.4 ms.
- Invalid pixels: none from these files. With the sky following the camera (the Outer Expanse fix, already in the repo), Camp II, rope, ridge and summit render zero black pixels by day.
- Not measured: live frame rate with the pane visible, the whiteout (the Netlify build has no `FCRealLight`), mobile.

## Weaknesses

- 60 m of real height. The illusion is the whiteout, the readout and the painted peak. Up close the summit is a voxel hill above a cloud plane.
- The trail is about 500 m. Ten to fifteen minutes with fights and ropes, less if you know it.
- Players can build or mine around the ropes. Granite is slow to mine, nothing stops it.
- God mode flies; the mountain ignores you while it is on.
- Fears use a simple chase on slopes. No pathfinding: a wall stops them.
- No NPCs on the mountain.
