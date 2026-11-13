# First Signal · 0.101

The first adventure built on the rule that the world shows you what is happening before anyone explains it. It starts by itself, it can be finished without opening a panel, and it leaves a part of Common Ground changed.

## What happens

1. **An incident you witness.** After about fourteen seconds on the floor of Common Ground the lights stutter. A courier staggers toward you across open floor and falls a few metres in front of you. Two or three people nearby turn, then run to her.
2. **Someone acts.** A mechanic runs in, kneels, lifts a pulsing key out of the courier's bag and turns to you. One spoken line gives the reason: the key is calling its station, and that station ran the east lamps.
3. **A route you can see.** She leads you east out of the hall, along the Seam's north road, to the edge of the Saltwake. She stops and waves when you fall behind. The key sends small lights toward whatever comes next. Dropped parcels and scorch marks lie along the road, a line of lights runs east, and birds break from the road as you pass.
4. **Three things you do with your hands.**
   - *Reconnect the relay.* The courier's cart tore the line. Pick up the loose end, carry it across the causeway, plug it into the dead pylon. The causeway markers light one pair at a time.
   - *Climb the fallen mast.* Six one-metre rungs up a toppled antenna. The power cell is in the housing at the top and cannot be reached from the ground.
   - *Carry the cell through the gate.* The mechanic hauls the shutter up and holds it. Seat the cell on the plinth inside.
5. **The discovery performs.** The Listening Station wakes around you: floor lines light, three fallen rings lift and turn, eleven scattered stones cross the court and settle into an arch on the blank face of the drum, a beam goes up, and the wall inside the arch sinks. The tide lamp is inside. You keep control the whole time.
6. **The ending happens in public.** Carry the lamp home. The mechanic seats it in the lamp house of the East Arcade, which has been dark and shuttered since before you arrived. Lanterns come on outward from the lamp, shutters lift, the sign changes, and people walk in.

Afterwards the arcade stays lit for that world. Two stallholders, a storyteller with listeners, the courier and the mechanic are there whenever you are near. **Take a cup** at the tea stall restores health. **Sit and listen** gets the next part of the storyteller's account.

## Rules this was built to

- No objective text, markers or quest log. The only interface is one verb beside the thing it acts on (`E / Tap · Plug in the line`), a subtitle strip, and speech bubbles.
- The order is enforced by the objects, not by a checklist: the cell housing stays locked until the line is whole, the plinth takes nothing but the cell, the door does not exist until the stones have formed the arch.
- Nothing teleports the player. The mechanic walks real ground using live collision, including player builds. If you outrun her by more than about 34 metres she reappears beside you, out of your view.
- Optional lore is in **Tools → First Signal · records** (mobile menu → Records): six short records, unlocked as you go, plus toggles for subtitles and spoken lines and a replay button once you have finished.

## Where things are

| Thing | Position |
| --- | --- |
| East Arcade | Under the east gallery of the Lantern Hall, x 213 to 219, z 24 to 43. Lamp house at (217.9, 32.5). It closes the gap between the two east towers. |
| Route out | Hall east walk, north around the tower corner at z −4.6, the Seam's north road at z 2.5, the Seam's east road, then the causeway at z 20 to 25. About 170 metres from the middle of the hall. |
| Relay, cart, mast | Apron x 288 to 309, z 4 to 31, flattened to standing height 2. |
| Listening Station | Court centred on (326, 22), radius 18. Gate on the west side at x 308.8. |

All of these are inside areas that are the same for every seed: the hall, the Seam and the Saltwake starter region.

## Generation and compatibility

- The apron and court are ordinary voxels stamped after the Saltwake's own generation, using existing block IDs 180, 181 and 184. No new block IDs. Needles within about six metres of the site are removed. Saved edits still overlay the result. A world that had already explored that corner of the Saltwake will see its base terrain there change.
- The Inverted Cathedral, its court and its echo stones are untouched. The nearest point of the station court is over 42 metres from the cathedral's centre.
- Walls, drum, gate, door, mast, pylons, stalls and the lamp house are meshes with matching collision boxes, added to chunks as they generate, the same way the Lantern Hall does it. The gate and the door switch their collision off when they open.
- No lights are added to the scene. Glow is emissive material and additive floor pools, so nothing recompiles when the arcade comes on.
- Moving parts hold still under the reduced-motion preference. The opening flicker becomes one soft dim.

## State

Progress saves in local storage under `fc-signal-v1:<world seed>`: the stage number, the records found and where the courier fell. Preferences for subtitles and voice save under `fc-signal-prefs`. It is per browser and per world, like the Outer Expanse journal. It is not account-synced, and other residents online do not see your courier, your mechanic or your lit arcade.

Reloading in the middle resumes from the last thing that held. A reload while carrying the cell puts the cell back in the mast. A reload during the station's performance finds the station awake. A reload while carrying the lamp keeps the lamp.

The stage numbers and the fixed coordinates at the top of `first-signal.js` are the save format. Do not reorder them.

## Canon to confirm

These were chosen to get the sequence working and are constants in the `CANON` block at the top of `first-signal.js`. Change them freely.

- The mechanic is **Ives**. The courier is **Tamsin**.
- The ruin is **The Listening Station**, a tide-and-star station on the Saltwake's edge. It is a new, smaller ruin. The Observatory of Tomorrow in the Violet Rift is about 540 metres from Common Ground, too far for a short first adventure, and was left alone.
- The thing brought home is **the tide lamp**. The place it lights is **The East Arcade**.
- All spoken lines, bystander lines, the storyteller's six-part account and the six records.

## Known limits

- The spoken lines use the browser's speech synthesis. Voice quality depends on the device. It follows the game's sound switch and can be turned off in the records panel.
- The mast, the gate and the ring wall are obstacles for someone on foot. A player who flies or mines can go around them. The sequence still holds because the objects enforce the order.
- The player's own avatar does not animate holding the line, the cell or the lamp. The carried object floats at hand height in front of you.
- Street events are ended when the incident begins, so two crowds do not overlap.

## Verification

`node _test/first-signal.test.cjs` plays the whole adventure: the arcade starts dark, the incident runs with no panel and no pause, the mechanic walks out and back on real ground and waits when the player lags, the cell is unreachable before the relay and from the ground, each rung of the mast is standable, the gate opens only while hauled, the station's rings, arch, door and beam reach their final state, the lamp is installed, lanterns and shutters respond, people gather, tea and the story work, the records panel fits a phone, the ending survives a reload, and replay restores the dark arcade. It captures a view of each beat into `_test/out/first-signal-*.png`.

The test steps the adventure clock by hand, so its result does not depend on frame rate. It does not measure frame rate.

Deploy the HTML and scripts together. `first-signal.js`, `quiet-interface.js` and `mobile.js` use the 0.101.0 cache version. A GitHub push alone does not redeploy the hosted server.
