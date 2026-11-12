# Outer Expanse · 0.100

Open **Tools → Outer Expanse · expeditions**, or **mobile menu → Explore**. Pin a survey lead for a compass bearing and distance. Travel normally; the journal does not teleport players.

## Three new biomes

| Biome | Monument | First survey location |
| --- | --- | --- |
| Saltwake Expanse | The Inverted Cathedral: an upside-down nave, downward spires and a monumental broken halo over salt flats | X 360 / Z 72 |
| Ossuary Forest | The Saint That Never Lived: colossal ribs, a fossil skull and a suspended amber heart amid branching marrow trees | X 72 / Z −360 |
| Violet Rift | The Observatory of Tomorrow: displaced tower drums, fractured stairs and an astronomical ring above purple mineral scars | X −360 / Z 72 |

Each site has three physical echo stones near its southern side. Walk to a stone and press E or tap its prompt. Read the inscription, attune the traces in the stated order, and uncover the site's final account and discovery title. Incorrect guesses preserve progress. A completed account remains readable in the field journal. Titles are personal records, not inventory items, server rewards or new powers.

## Generation and compatibility

- The original city and its immediate outskirts keep their district selection. New biomes occupy complete 6 × 6 chunk regions whose nearest edge is at least twelve chunks from the origin. Each region is 144 metres across.
- Three starter regions are guaranteed for every seed. Beyond them, a separate deterministic seed hash selects the three new biomes or leaves a region under the existing nuclear/biowaste/scrub generation. Further sites repeat the three authored monument families and their stories.
- Terrain heights use world coordinates for shared edges. Each monument has a flat central court and reachable stones. Wilderness growth is deterministic. The floating parts are deliberate impossible geometry.
- All terrain, growth, landmark structures and echo stones are ordinary voxels. They use existing meshing, collision, mining, edit overlay and chunk streaming. Seven block IDs, 180–186, are added; existing IDs are retained. Previously explored outer regions may change their procedural base terrain; saved edits still overlay it.
- New regions skip legacy automatic city fittings and ground smoothing. This prevents street screens from appearing against echo stones. New regions do not receive legacy random wild loot. Existing radiation/biowaste remains in retained old regions, with its existing warnings.
- No additional mesh batches, dynamic lights, external assets, fetches or server save writes are added for the new terrain. Geometry uses existing voxel batches. This is not an FPS improvement claim.

## Field records

Discovery, sequence progress and completion are saved in local storage under `fc-expanse-v1:<world seed>`, up to 128 site records. Online players see the same seeded terrain, but each browser keeps its own journal. It is not account-synced. Storage failure is reported; progress can remain in memory for the session. A removed echo stone cannot be attuned until restored. Pinning is session-only.

## Travel rendering

The sky sphere now follows the camera, matching the existing clouds; it no longer exposes its back faces when the player travels outside its former origin-centred radius. Artificial city skyline rings are hidden outside 288 metres on either axis and restored upon return. Real loaded city buildings remain real geometry.

## Verification

`node _test/outer-expanse.test.cjs` checks the protected inner city, all three starter biomes, real landmark voxels, accessible clue stations, incorrect-order feedback, completion, phone-width journal layout, mined stone persistence on chunk reload, saved field records, discovery history, wilderness skyline visibility and restoration when returning to town. The test captures one view per biome and the phone journal. No server authority or rewards were added.
