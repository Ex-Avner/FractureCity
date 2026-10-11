# City workshop — v0.45.0

Press B after the prologue, or choose Build this room in Radio & menu. The catalogue pauses the city. Enable Creative supplies, choose a finish and room piece, then Return to city. Right-click places; left-click mines; T rotates; B exits building. On touch screens use Build / Place and the catalogue Rotate button. E opens or closes workshop doors.

22 textured finishes: plaster, tiles, checkerboard, terrazzo, woods, bricks, concretes, metals, velvet, light tiles and frosted glass. Oak and steel door surfaces occupy two further fixed block IDs. Fifteen kits cover single blocks, floors, walls, windows, three stair layouts, two doorways, an arch, counter, bookcase, sofa, stage and light strip.

Room construction uses city voxels, collision and the existing per-city edit save. Fixed IDs 120–143 must stay stable for old saves. New rooms cannot overwrite occupied cells or the player. Creative supplies are required for kits; ordinary inventory-based building remains available. Undo/redo is session-local and stops if the affected area has changed. Doors store their open state per city and preserve air edits across generation. Explicit slot saves flush pending door metadata.

The city generation wrapper reapplies saved edits after shop and street decoration so these passes cannot close a player-made doorway. Textured faces are instanced by material per chunk and rebuilt on edits; materials are shared across chunks.

This is local in-world construction. It does not publish rooms to a server. Backroom photo/music uploads remain in the separate artist studio.

Verification: _test/city-build.test.cjs exercises real player stair movement, whole-kit placement, body/occupied-cell protection, undo/redo conflicts, interaction through the crosshair, door collision protection, persistence, textured batching and responsive catalogue sizing. Run against either the repo or _build/netlify-mobile.

## Fine art and interiors — v0.46.0

Open B → Fine art & interiors, or Radio & menu → Interior & art workshop. This stays in the current city. An orbitable live view and side inspector support 5 cm grid placement, precise dimensions (minimum 2.5 cm), three-axis orientation, custom colours, matte/gloss/metal/glow/glass finishes, selection, grouping, whole-group rotation and scaling, nudges, duplication and configurable row/ring arrays. Drag outside the inspector to orbit; scroll to zoom. Click view: SELECT chooses visible art; Click view: PLACE stamps the current shape on a city voxel surface. The work light is editor-only and can be switched off.

Eight shape types include box, sphere, cylinder, cone, ring, wedge, text sign and a paintable 16×16 mural. Six furniture/sculpture starting points and a 113-part listening room can be edited or dismantled. Fine pieces are decorative and non-colliding; use the structural workshop for floors, stairs and walls that players walk on.

Per-city art lives under city-art-<seed>, separate from structural voxel edits. Autosaves are serialized; explicit slot saves flush pending artwork. Undo/redo keeps 40 snapshots for the current session. The 1,200-piece and 24-sign/mural limits bound local rendering and storage costs; primitives are instanced by geometry/finish and large selections use one bounding outline. Blueprint export includes the selection, or the full collection if nothing is selected. Import validates every part before changing the city and never executes code or fetches external assets. Built-in room designs also use this format. Sharing a blueprint file is supported; online publishing and collaborative editing are not included.

_test/city-art.test.cjs covers the actual inspector, precise edits, groups, arrays, painting, save/reload, invalid and oversized imports, viewport orbit/select/place, the sample room, and touch interactions. Physical iOS-device performance remains unverified.
