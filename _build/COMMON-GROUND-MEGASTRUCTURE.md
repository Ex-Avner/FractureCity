# Common Ground — The Lantern Hall

## Revision 3: a place to explore

The arrival now presents a complete fractured-ring silhouette, distinct activity thresholds and a furnished destination upstairs. An optional directory turns the hall’s existing activities into six clear first stops. Existing saved worlds, player buildings, the twelve online building plots and the shared v0.90.0 lighting system remain in place.

### Player experience

Press **L**, or select **Explore Common Ground**, to choose a destination. Reading garden, listening booth, arcade corner, People’s Gallery, overlook and theory library each explain what the player can do there. Selection supplies the next safe walking turn and distance, feeding the existing world marker and map. There is no forced introductory modal and no teleport. E retains its existing interaction behavior. Closing or cancelling restores ordinary exploration.

Ground routes use the live collision field and floor support, so they lead around the reading wall and saved obstacles. The overlook route follows the physical stair, passes around the structural footing and returns through the bottom landing before crossing the court. Obstructed routes give a clear message and can replan. Directions yield to readers, dialogue and other game panels. The directory supports keyboard focus, Escape and narrow touch layouts.

Two legacy guides were pointing to obsolete gallery positions at z33 and z41; both now target the actual promenade at z62. The online listening milestone now checks the current booth approach.

### Architecture and scale

| Element | World dimensions / position | Access |
| --- | --- | --- |
| Main room | x140–217, z−2–72; floor y1 | Existing social court |
| Four vault ribs | z−2 / 22 / 46 / 72; rise 98 / 126 / 158 / 192 | Scenic above public levels |
| Fractured ring | Center (167,17,53), radius 7.2 | Landmark; slowly moving segments |
| West stair | x140–144, z30–42; 24 × 0.25 rise / 0.5 going | Walkable, no jump required |
| Overlook | x140–146, z42–62; floor y7 | Public lounge, guarded perimeter |
| Lounge canopy | Center (142.5,11.3,53.5), 5.8 × 13 | Slatted shade over the seating |
| Arrival seats | x160.7 and 173.3, z28 | Outside the central walking route |
| Gallery approach | z62; displays at z65 | Existing read/publish interactions |

The first six meters now carry more visual information: contrasting canopy edges at theory and listening, readable destination signs, timber seating with terracotta cushions, pendant lamps, books, cups and hanging planting. Teal stair inlays continue around the overlook footing. Upper galleries gain ceiling returns and side cheeks to read as rooms. Textile accents remain clear of the central landmark. The reading-wall title is larger; duplicate overhead boards were removed after player-view review.

The ring, stone fragments and small listening chime move at restrained speeds. Reduced-motion preferences hold these objects still. The high galleries remain scenic; this revision does not add playable floors above the overlook.

### Building and performance

Architecture uses material/section instance batches, a shared destination-sign atlas and four existing non-shadowing lights. The lights stay in the scene and fade through the existing Real Light zone integration. The original 64-block voxel allocation is unchanged. Saved edits still apply after generation; decorative ground paving hides over removed support. Furniture collision matches the authored bases and backs. Scene rebuilding disposes owned geometry, materials, textures and instances.

Measured in the tested arrival view on the performance tier: **76 additional draw calls and 37,744 triangles** for the whole hall compared with the same scene with the hall hidden. This measures render workload, not frame rate across devices. No global lighting/exposure settings are replaced.

### Verification

- `_test/common-ground-megastructure.test.cjs`: spawn, twelve plots, facility approaches, actual walking ascent/descent, guards, saved edits, chunk regeneration, floor holes, render budget and disposal.
- `_test/common-ground-guide.test.cjs`: optional arrival, six destinations through actual movement physics, live waypoint advancement, stair return, focus and pause handling, click isolation, blocked routes, reader coexistence, scene changes, mobile layout and stale-coordinate regression.
- Existing reading-garden, Common Ground campus and respawn suites verify the installed game’s interactions and online behavior.
- The v0.90.0 Real Light behavioral assertions pass, preserving the shared look table and constant interior light count. Its software-rendered image capture required a longer timeout during local verification.

### Implementation boundaries

This revision is installed and validated for publication. No new server endpoint, account action, save migration or public content is introduced. The revision’s rollback archive records the previous eight files and identifies the two new files to remove when reverting.
