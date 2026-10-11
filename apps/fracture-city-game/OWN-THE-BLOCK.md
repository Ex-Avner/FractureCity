# Own the Block — v0.47.0

A separate saved-city mode accessible from the main menu. The current city is saved before creating it. It retains the main city, its minigames and the existing building/art tools; new progress is local per city, not an online account or multiplayer publication.

## Play loop

1. Walk to Studio 01 and press E (or the touch prompt) to claim its key.
2. Use B → Fine art & interiors to design the room. Moss on the promenade offers three commissions that inspect real objects within the studio: a sign and four-colour mural; an eight-part composition with three shapes/colours; and a sixteen-part interior using two finishes across four metres. Each pays once. Checks measure completion, not artistic merit.
3. Feature a painted mural on the local public gallery wall.
4. Complete all three commissions, then invite three neighborhood characters to an open studio. They navigate through the physical doorway with the same collision-aware ground movement used by residents. Blocking the entry can stop visitors. Arrival progress persists; an eight-second viewing period completes the event.
5. Explore five readable street fragments, visit the radio stage to play the packaged soundtrack, or race Signal Run. The rooftop route has thirteen ordered, elevation-aware checkpoints; timing starts at the first ring. Gold is under 19 seconds, silver under 30; bronze records any valid finish. Best time and highest medal persist. Teleports make a run unranked; medal rep is awarded only for improvements.

The neighborhood comprises six authored chunks (6/7 × -1/0/1), with a studio and mezzanine, accessible roof deck and bridge, rehearsal warehouse, open radio stage, garden and canal. Random wall fittings are disabled there so bins and fixtures cannot block the intended stairs. Player voxel edits still apply last. Old story/free-roam cities retain their procedural district unless they were created as Own the Block.

## Input and presentation

Foot movement now has frame-rate-independent acceleration, air steering, 115 ms coyote time, 140 ms jump buffering and release-controlled jump height. Holding jump does not repeatedly hop. Existing class speeds, collision, ice hooks and skateboard movement are preserved.

The mode uses one compact objective with direction/distance, a contextual E/touch prompt and a neighborhood board that pauses on request. At most two toasts are visible game-wide. The Atelier can export a PNG of the current composition as well as editable artwork blueprints.

## Persistence and verification

Career records use own-block-<seed>. Saves await loading and queued career writes. Restores validate fields and keep cities isolated. New worlds do not reuse the previous city's ownership, commissions or collections. Actor paths and active race timers are session state; already-recorded visitor arrivals and best times are durable.

_test/own-the-block.test.cjs exercises actual walking/E entry, commissioned artwork, once-only rewards, public murals, collections, the collision-traversable complete race, teleport rejection, actual visitor arrival, career/artwork restore, isolation, movement timing, touch controls and notification limits. Existing story, campaign, building and art suites remain required. Physical iPhone/VR hardware testing is separate from browser emulation.
