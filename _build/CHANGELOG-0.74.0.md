# Fracture City 0.74.0 — Future city surfaces

- Cooler concrete, pavement, roof and metal palette, preserving brick and player-selected pigments.
- Building windows gain projecting frames, mullions, blue glass and warm procedural interior imagery.
- Selected exterior walls gain weathered metal panels, inset seams and restrained cyan accents.
- Small roof ventilation housings sit on actual roof tiles. Lamps gain luminous collars and service sleeves; benches gain metal slats and a light edge.
- Architectural decoration is instanced in at most four batches per chunk, capped at 180 wall faces and 12 roof tiles. Distance limits follow the existing graphics tier. No additional point lights.
- Decorations validate their source blocks after saved edits load and when blocks change. Removing a support or covering its exposed face hides the associated detail.

## Validation

- `node _test/future-city.test.cjs`: real geometry, support/exposure validation, bounded batches, mined support removal, saved removal across chunk reload, roof support removal, distance culling and browser errors.
- `node _test/city-grounding.test.js`: grounded street props, clear lanes and doorways, bench collision and landing height, support removal and narration behavior.
- Visual inspection of the generated street scene at high graphics quality.

This is a local visual update. Deployment and Git push are separate steps.
