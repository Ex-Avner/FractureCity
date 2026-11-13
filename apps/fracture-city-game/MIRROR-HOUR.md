# The Mirror Hour · 0.103

One module, `mirror-hour.js`. Claude's own piece, built into the city.

## What it is

Every night between 20:30 and 04:30 city time the Fractured Mirror rises over the skyline: eight shards of an octahedron, drifting apart and together, each one holding a sky that is not this one. An aurora in the three axis colours crosses overhead. A thread of light climbs to the mirror from the centre of every intersection, with pulses travelling up it. Motes drift through the streets. By day the mirror is a ghost, like a day moon.

Walk through the foot of a thread and it rings: a bell, and one line of a sixteen-line poem. Each intersection carries one line, fixed by its coordinates, so the poem is scattered across the city and found in any order. Hear all sixteen and the shards draw close and stay close. The mirror does not close.

## The poem

Written for this. It lives in `LINES` at the top of the file. Edit it there; the count, the scale and the progress text follow the array.

## Controls

- Phone menu and the Tools menu: **The Mirror Hour**. Holds the hour for ten minutes whatever the clock says and shows the poem as far as it has been found. Again to let it go.
- `FCMirrorHour.toggle()`, `.summon(seconds)`, `.release()`, `.read()`, `.reset()`.

## How it is built

- Six objects: mirror, halo, aurora dome, threads, ground rings, motes. All procedural shaders. No textures, no downloads.
- Threads are one instanced ribbon bent along a curve in the vertex shader. At most 64, the nearest intersections within 120 m.
- One directional light, created at start-up at zero intensity so nightfall recompiles nothing.
- Everything sits inside the game's 380 m sky dome, which writes depth.
- By day only the ghost mirror draws. The rest is invisible and skipped.
- Sound is Web Audio: a held fifth under the hour, a three-partial bell per thread on a pentatonic scale, a feedback delay for space. It follows the game's sound switch and starts only after a touch or key press.
- Progress is stored per browser in `localStorage` under `fc-mirror-hour`. It is not on the account and not shared online.

## Limits

- Frame cost is unmeasured on a GPU. The aurora is the expensive part: twelve noise samples per sky pixel. If phones struggle, it is the first thing to cut.
- Not rendered on a phone, real or emulated. The test runs at the Performance tier in a desktop viewport.
- The sound has not been heard by anyone. Headless Chrome has no audio output; the code path ran without error and that is all.
- The mirror follows the camera the way a moon does. It is not a place you can fly to.
- Online, each player has their own progress and holds their own hour. Night is shared because the clock is.
- The game's bloom is strong at night. The mirror's brightness was tuned against it at the Balanced tier only.

## Verification

- `node _test/mirror-hour.test.cjs`: ghost by day with the light at zero; threads only on intersections; every shader compiles; walking into a thread rings it, shows its line and saves it; the sixteenth line completes the poem; no browser errors.
- `node _test/mirror-shots.cjs desktop`: frames into `_test/out/`.
