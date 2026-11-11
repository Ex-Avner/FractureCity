# City architecture refinement · 0.99

The city shares a civic material family: pale limestone, dark basalt, patinated green metal, aged bronze and warm windows. Residential and market streets retain clay and brick; the Forge keeps industrial roofs; Downtown keeps setbacks and spires; Flood Gate keeps tiled elevations. The Church and Common Ground remain the monumental anchors.

## Built changes

- Procedural buildings in all five urban districts receive four-metre stone bay rhythms, floor bands and bronze cornices. Only existing upper solid wall cells are replaced; doors, windows, empty setbacks and ground-level circulation are retained. Player edits still apply after generation.
- Facade detail is sampled deterministically across the full height instead of exhausting its allowance on the lowest floors. Stone window jambs, deep sills, shading hoods, bronze transoms and fluted stone replace unrelated bolted metal panels. Curtain-glass buildings now participate.
- Existing facade limits remain 180 wall anchors + up to 12 roof anchors, in at most four instanced batches per chunk. Mining a supporting voxel hides its detail; lower graphics tiers retain distance culling. No new lights, requests, animations or save writes.
- The Archive and Resonance House gain matching portal arches and bronze-edged stone cornices. The church's existing architecture provides their material reference.
- The Custody House gains blind arcades, continuous plinths and a defined roof crown. The public entrance, cell doors and escape route are retained.
- The Backlot loses its blank warehouse silhouette: stone piers, bronze facade joints and repeated sawtooth rooflights connect its industrial character to the civic buildings. Three instanced batches; no new lights.
- Roads and paving share the same palette as the architecture. Night sky and ambient colours are less saturated so the material differences survive at night.

## Scope and limits

This is an architectural cohesion pass, not a replacement of every landmark. Existing district layouts, Common Ground, church interiors, player buildings and authored activities remain. The fine surface relief is cosmetic; voxel walls retain collision and mining authority. Existing landmark ornament remains authored mesh geometry. Course, jail and account functionality are unchanged.

No external assets or texture downloads are added. Detail selection does one bounded-budget generation pass, then uses the existing dirty-update and distance checks. This is not a claim of a measured FPS improvement.

## Verification

- `node _test/city-design.test.cjs`: wall occupancy, windows and doorway preservation across all five districts; upper-floor detail coverage and batch/light budgets; desktop, night and phone-sized render checks.
- `node _test/future-city.test.cjs`: support validation, mining, reload, roof equipment and performance-tier distance culling.
- `node _test/civic-landmarks.test.cjs`: doors, floors, collisions, college entry, church library/reflection, music interaction and saved progress.
- `node _test/jail-browser.test.cjs`: real civilian-death intake, confinement, persistent sentence, timed six-stage escape and phone layout. The confinement assertion now waits for its condition rather than assuming the browser always renders within 250 ms.

Deploy the matching HTML and scripts together; changed scripts use the 0.99.0 cache version. GitHub push alone does not redeploy the hosted server.
