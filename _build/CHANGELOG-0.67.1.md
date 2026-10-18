# v0.67.1 — First-person room building

- B enters room construction without opening a paused catalogue. The catalogue remains available from its button or backtick.
- In-world toolbar and shortcuts cycle room kits ([ / ]), finishes (, / .), rotate (T), toggle creative supplies (F8), and undo/redo (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z). Touch-friendly buttons expose the same actions.
- Whole rotated kits seat against the selected floor, wall, or ceiling face; placement and preview share the same anchor calculation. Occupied space and player overlap still reject the entire kit.
- Placement previews update every animation frame and reuse their mesh/material instead of allocating a new GPU object every 150 ms. Chunk finish rebuilding remains throttled.
- The toolbar explains invalid placement and disabled supplies. Art mode keeps its existing controls without the room rotation handler consuming T.
- Structural edits retain their existing save and online behavior; this release does not add shared structural persistence or change permissions. Fine-art editing remains available through the existing workshop.

Validation: browser building regression suite, all 15 kits × four rotations × six surface normals, keyboard entry/cycling/supplies, stairs, door interaction, undo/redo, save/reload, mobile catalogue, and existing art editor regression suite. Stair fixture now removes generated prop colliders as well as voxels so it tests the authored staircase in isolation.
