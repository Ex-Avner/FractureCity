# Common Ground / The Lantern Hall

## Revision 2: grounded arrival and playable overlook

Replaces the rejected floating rectangular enclosure. Four concrete ribs now rise from actual ground footings into an ascending vault (98 / 126 / 158 / 192 units above the floor). A continuous roof slit reveals the sky. Deep side galleries follow the vault's curvature, with bronze screens, recessed glazing and warm occupied windows. The principal arrival landmark is a segmented bronze oculus surrounding three displaced stone fragments, visible from the actual spawn rather than only when looking straight up.

The arrival canopy, stone paving, bronze path inlays, library framing and warmer reading-garden palette connect the architecture to the existing social court. The reading wall, library, music booth, gallery and six arcade positions are retained. Trees use clustered instanced foliage and fewer drifting pages. Existing player structures remain visible; they have not been deleted to improve a screenshot.

## Playable geometry

A new west-side stair at x=140..144, z=30..42 rises from world y=1 to y=7 in 24 quarter-unit steps. It leads to a guarded 6 x 20 unit overlook at x=140..146, z=42..62. The stair, deck, guards and podium use the engine's existing fractional prop-collision system. Normal walking climbs and descends without jumping. Both directions are tested through updateWalkPhysics, including stable landing and guard restraint.

The old generated west-edge voxel geometry is cleared within x=138..146, z=28..64 during chunk generation. Saved edits are applied afterwards by the existing engine, retaining their precedence. The surface courses check their underlying ground and hide above edited holes. The twelve online building plots are explicitly tested against every new collision box; their build volumes stay clear. The original 64-block voxel allocation is unchanged.

A 0.001-unit AABB contact tolerance fixes repeated step-assist bumps caused by floating-point residue on fractional-height landings. This changes contact tolerance only, not movement speed, jump height, step height or server limits.

## Boundaries

The +6 m overlook is playable. The high occupied galleries, vault and oculus remain scenic; this release does not claim that every visible floor is accessible. No new teleport or server endpoint is introduced. No saved data is migrated. Surrounding player buildings and social content are preserved.

This revision replaces the previous floating-shell first pass. The installed-game architecture, reading-garden and solo/online respawn checks passed before publication.

## Verification

Run `node _test/common-ground-megastructure.test.cjs`. The suite checks:

- clear original spawn and facility approaches;
- all twelve online player plots free from new collision;
- stair ascent, stable landing, guard restraint and descent through actual movement physics;
- chunk regeneration without duplicate collision or scene roots;
- saved voxel edits applied over authored geometry;
- decorative paving hidden over removed ground;
- scene disposal and recreation without browser exceptions;
- incremental rendering cost and day/night captures.

The measured architectural overhead was 64 draw calls and 34,926 triangles in the tested arrival view on the performance tier. This is a geometry measurement, not an FPS guarantee. Final results and compatibility checks are recorded in the delivery note.

## Files

- `apps/fracture-city-game/common-ground-megastructure.js`: architecture, lighting, collision blueprint and paving lifecycle.
- `apps/fracture-city-game/reading-garden.js`: art palette, library title treatment and instanced foliage; reading behavior retained.
- `apps/fracture-city-game/index.html`: cache versions and fractional collision tolerance.
- `_test/common-ground-megastructure.test.cjs`: behavioral regression and image capture.

Reload the existing game to see the installed changes. The rollback ZIP contains the five files as they were before this revision and contains no private saves.
