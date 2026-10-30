# Common Ground: inhabited hall, architectural pass 1

Implemented against live local commit ac84ce3 (v0.89.0), not the supplied v0.87 backup.

## Installed scope

The game now loads `common-ground-megastructure.js` after the existing feature modules. It adds a 192 x 144 unit perimeter envelope centered at world (180,36), a 96 x 72 unit inner atrium, a roof 192 units above the existing floor (world y=193), stacked inhabited facades, two supported bridge silhouettes, a roof aperture and trusses, four orientation signs, and two displaced fragments. Two local lighting sources and locally reduced fog reveal the vertical interior. Architecture is deterministic and grouped into 52 instanced material/sector batches (5,853 box instances).

The new enclosure is independent of the 64-block voxel storage. The original campus, books, listening booth, studios, gallery artworks, arcades, player plots, respawn and saves retain their coordinates and behavior. No save migration or server changes are made. The module does not issue network requests.

This is the first architectural pass, not completion of the full design specification. Upper tiers, bridges and fractured structures are scenic. No lift controls or upper destination prompts are advertised. Ground-level district relocation, load-bearing lower podium integration, full public elevated collision, accessible lifts and multiplayer-authoritative travel remain subsequent work. The scenic shell is visible from surrounding streets; the wider city has not been regenerated to fit a new footprint. This avoids erasing player-owned plots or existing gameplay.

## Integration

- `apps/fracture-city-game/index.html`: one final script include.
- `apps/fracture-city-game/common-ground-megastructure.js`: owned scene group, instancing, material/texture disposal, local fog adaptation, visibility bounds and diagnostic API `FCCommonGroundMega`.
- `_test/common-ground-megastructure.test.cjs`: browser regression test using the existing harness and a fresh browser profile.

The existing day/night function is wrapped after all current modules. It computes the outside lighting/fog first; the hall then applies its local fog blend. Scene replacement disposes owned resources and rebuilds once. Chunk regeneration does not own or duplicate this scene-level enclosure. No changes to the global voxel height, day/night settings, or persisted user options.

## Validation

Run `node _test/common-ground-megastructure.test.cjs` from the project with local browser-test dependencies installed. Checks: single enclosure; unchanged 64-block height; safe spawn; original arcade approach ground elevation; chunk reload; hide/restore at distance; scene disposal/rebuild; fog restoration; no browser exceptions; render overhead under 60 draws / 80,000 triangles in the test view.

Observed before installation: 45 additional draw calls and 69,290 triangles in the arrival view. This is incremental geometry cost, not an FPS or 48-player performance guarantee. No multiplayer load or minimum-device performance certification has been performed.

## Rollback

Restore the previous index.html from the separately supplied rollback ZIP; remove the new module, this note and its test. The ZIP contains no private save data. The existing desktop launcher points directly to this project's index.html; reload the game to pick up the change. This does not deploy a hosted website.
