# Smoother play and a clearer phone HUD

Automatic graphics now starts at Balanced (Performance on devices reporting two or fewer cores or 2 GB of memory). Explicit saved graphics choices still win. Sustained frame times above 25 ms for three seconds trigger a lower tier, after a two-second settling period; ongoing world streaming no longer prevents this response.

The world streamer reuses its pending work while the player remains in the same chunk, invalidates on movement, quality or world changes, and audits every 500 ms for external edits. Ground beneath the player remains immediate. Actor support queries avoid duplicate voxel samples and temporary allocations; collider contents remain live, including moved props and player edits. The farm calendar reuses its date formatter and day label without caching weather events.

On phones, Menu and Map are the permanent navigation buttons. Jump and a nearby contextual action occupy the right thumb area. Mine and Place appear while building; combat controls appear for Siege, campaign combat or opt-in PvP. Equipped character abilities remain directly accessible. Inventory, building, exploration, friends and tools remain available through the menu. The build palette uses horizontally scrollable 44 px slots. Secondary prompts no longer stack over the thumb controls. HUD updates avoid redundant per-frame DOM writes and repeated full layout measurements.

## Validation

- Streaming and quality policy regression: world reset, teleport, missing chunks, same-size map mutations, tier changes, manual graphics lock and sustained load.
- Collision regression: 4,000 comparisons with prior behavior, moving/replaced colliders, voxel edits and unloaded chunks. Existing actor lifecycle and farm tests passed.
- Mobile browser checks cover portrait/landscape, real touch and mouse menu input, utility sheets, exploration routes, inventory, build entry/exit, reading interaction, joystick release and camera drag.
- Garden traversal and saved-art preservation checks; save batching queue tests.

An eight-second Chrome run on the same Apple M1 at the same Common Ground viewpoint measured desktop 95th-percentile frame intervals of 49.9 ms before and 16.8 ms after. Automatic quality changed from Ultra (121 loaded chunks) to Balanced (49). This includes the default-quality change and is not a same-quality rendering benchmark. The mobile-emulated viewport stayed around 16.7 ms in both runs; a physical phone has not been measured. A same-page isolated benchmark of 10,000 actor support queries measured 16.7 ms before and 4.7 ms after; this is CPU query work, not a whole-game FPS claim.
