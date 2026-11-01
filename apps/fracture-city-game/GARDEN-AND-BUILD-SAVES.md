# Conservatory Garden and background building saves

The former Atelier and unfinished Forum have been replaced by a connected public garden. Building in an online plot now updates immediately and saves in batches without locking placement behind a request.

## Building saves

- A 700 ms idle delay groups a short burst. Continuous building starts a save within 3 seconds when a request is not already running. Requests are serialized, with at least 1.6 seconds between writes to remain below the existing server write limit.
- New edits made during a request remain visible and are saved afterward. Undo/redo operates on changed cells and doors, so unrelated remote edits are preserved.
- A compact unsaved difference is stored in this browser, scoped to the room and account. Reloading reconciles it against the online plot. Clearing browser storage removes that backup; when browser storage is unavailable, the status explicitly tells the player to keep the tab open.
- The existing server remains authoritative for ownership, plot bounds, block limits, occupied spaces, materials, wallet deductions, and revision checks. No database or server protocol migration is required.
- Ambiguous responses are read back before resubmission. Changes to different cells merge; a conflicting change to the same cell pauses publishing and offers **Keep my draft** or **Discard unsaved draft**. Validation failures retain the draft and offer retry.
- Pending blocks reserve inventory immediately. Plot signs are rebuilt only when ownership or labels change, not whenever a block is saved.
- Manual Save waits for pending building writes. A failed flush reports that the draft is not yet online. Closing an unsaved page triggers the browser's leave warning.

## Garden

The 48 × 22 m garden occupies x144–192, z1–23, with its principal walk at ground level. The old studio floor at x148–164, z4–20 remains at elevation 2 as an open art terrace. Walls, mezzanine, bridge, Forum deck, piers, and old roof stairs are removed from generation.

The garden uses flowering groves, layered planting, a shallow reflecting rill, a flush crossing, stone paths, timber seats, and small emissive lanterns. The central route stays open. Trees and seats have physical collision; planting and solid furniture stream with their owning chunk. No new dynamic lights or shadow maps are added. The two garden chunks use 14 and 15 mesh draws, totaling approximately 54,000 triangles.

Saved voxel edits and fine-art objects are applied after generation and retained at their coordinates. Existing artwork on upper structures is not deleted or automatically relocated. The main art floor retains its height; ownership, commissions, visitors, and career progress remain compatible. The retired roof recording is now on the ground, and Signal Run follows a traversable garden circuit. Previous roof-course best times are retained separately from the new course.

The directory adds Conservatory Garden and routes visitors out of the raised art terrace through its entrance before continuing to the hall or overlook.

## Verification

- Queue regressions: rapid bursts, bounded continuous saving, edits and undo during a delayed request, lost acknowledgements, offline recovery, reload recovery, unrelated remote edits, conflicts, rejected builds, and unavailable local storage.
- Actual Chrome/server test: 110 placements through a deliberately held response produced exactly **2 structure writes**. The first 100 local placements took approximately 14 ms in that run. This is a test result, not a production frame-rate or latency guarantee.
- Two clients: shared collision, undo/redo, visitor door opening, chunk reload, and server restart/rejoin.
- Garden: removed architecture, every garden/run route with native walking collision, recording accessibility, saved art/voxels, and per-chunk rendering budget.
- Directory: all seven destinations, both directions on the overlook stair, terrace exit, blocked paths, focus/keyboard control, and a 390 px viewport.
- Resident career: commissions, rewards, recordings, visitors, saves/restores, isolation between cities, and touch controls.

Tests: `_test/structure-save-queue.test.cjs`, `_test/structure-batching-browser.test.cjs`, `_test/structures-browser.test.cjs`, `_test/extended-garden.test.cjs`, `_test/common-ground-guide.test.cjs`, `_test/common-ground-campus.test.cjs`, `_test/own-the-block.test.cjs`.
