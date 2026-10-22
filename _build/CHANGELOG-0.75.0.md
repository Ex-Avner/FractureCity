# Fracture City 0.75.0 — Common Ground civic campus

## Space and architecture

Common Ground grows from two 24 m square blocks to five: a 2,880 m² authored footprint, 2.5 times the previous 1,152 m². The existing reading garden remains at its original coordinates; new public ground occupies chunks 6,2 / 7,2 / 8,1. The online building yard at 8,2 and its existing player-owned plots remain untouched.

The low elliptical canopy and accumulated old façade trim are replaced by an open-sky garden, vaulted Atelier entrance, sculptural Forum roof crest, finished balcony and stair details, stone and bronze surfaces, and a sheltered south gallery. New court trees, seating and a shallow east water garden connect the smaller reading court to a larger gathering space. Two shadowless warm lights mark the studio and gallery.

Gallery displays move from z=44 to z=65, with their existing slot IDs and content intact. The street guide now targets z=62. Empty exhibition panels use a quieter invitation design. The broadcast-choice notice moves from the central sightline onto the studio façade. Showcase invitations yield while another nearby interaction is active.

## Continuity and persistence

- Fixed a real rooftop-generation bug: building centres were already world coordinates, but roof detail added the chunk origin again. Roof detail now uses the correct centre and roof height.
- Studio bounds, user artwork, commissions, saved voxel edits, roof race, reading content, music and Chainfire remain compatible.
- New paving instances hide when their supporting floor tile is removed; generation precedes saved edits.
- Tree crowns and roof arches validate their structural supports.
- Shared procedural surface textures are retained during individual chunk disposal.
- Authored maker chunks report Common Ground as their district, preventing random wilderness radiation from leaking into the square.
- The gallery refreshes when initial account loading completes, avoiding the temporary guest-state display for signed-in residents.
- No database migrations or server-side plot changes.

## Validation

Passed browser suites:

- `node _test/common-ground-campus.test.cjs`: real collision traversal, shallow water footing, rooftop coordinate regression, saved art/voxel preservation, floor support removal, geometry budgets, online plot isolation and narrow-screen gallery controls.
- `node _test/reading-garden.test.cjs`: library, online catalogue, books, music/theory kiosk access and phone reader.
- `node _test/social-world.test.cjs`: publication, cross-account replies, moderation, persistent private drafts and touch publishing. Updated stale test entry flow and explicitly selected the arena for the arena portion.
- `node _test/common-challenge.test.cjs`: contributions, imports, persistent guestbooks and phone panel.
- `node _test/own-the-block.test.cjs`: commissions, studio ownership, save restore, complete rooftop route, visitors, movement and touch controls.
- `node _test/chainfire.test.cjs`: cabinet collision, game launch, return and phone viewport.

The generated campus contains at most 19 mesh draw calls per chunk in the tested scene; its boxes are instanced by material. A same-seed, same-view 1280×800 Chrome comparison sampled 90 frames after warm-up for each graphics tier. Median frame cadence was 16.7 ms before and after. Performance-mode scene counts changed from 1,121 to 1,073 draw calls and 422,168 to 333,448 triangles. These are local desktop measurements, not a physical-phone benchmark. High-tier renderer counters report the final postprocess pass and are not used as scene totals.

## Delivery

Local source and package version metadata updated. Not pushed or deployed. Reload the game to regenerate the district; existing player save edits still apply. See the generated local _test/out/common-ground-review-0.75.0.md for matched views.
