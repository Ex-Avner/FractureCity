# Fracture City 0.36.1

The Minute now has a readable, ordered opening, grounded Wardens and a shared wet-dusk palette. Save block IDs, class IDs, the three decision IDs and all twelve option affinities remain compatible.

## Wardens

Every custom first-night movement path settles its ground body and publishes the resulting position: zero-heat patrol, escort, retreat, Hook, ground-slam knockback, Correction and frozen enemies. The character animation's `baseY` now follows the enemy too. Simply copying the mesh height was insufficient: the next walking animation reset it to the character builder's zero-height default.

## The diagonal beams were skateboard rails

Confirmed in the Civic Core using `FCDEBUG.set('rails', false)`. The beams disappeared with rails hidden; hiding cables, awnings, fire escapes, neon, shadows or bloom did not remove them. The legacy cable/awning/fire-escape overlays currently emit no geometry, which `FCDEBUG.counts()` reports explicitly.

The doorway handrail generator sampled `shSurfaceY(..., 8)` inside a solid building column and treated the returned height 9 as a stair landing. It joined that to street height 1 over a five-metre horizontal run. The resulting 9.43-metre diagonal was a real mesh, not a lighting artifact; its rotation correctly followed incorrect endpoints. It also measured the centre of the doorway before offsetting the rail sideways, without validating support beneath the actual rail.

The late wrapper now rejects impossible stair slopes, checks support and headroom every 0.35 metres along the actual offset span, and rejects gaps and abrupt rises before registering either geometry or a grind target. Valid pavement rails and skatepark rails remain. No dressing category was removed.

`window.FCRails` is a narrow extension seam for the enclosed rail builder. The main HTML was not restructured. `visual-cohesion.js` owns the fix, palette and debug controls; the web builder discovers and copies the new script automatically.

## Palette

`FC_PALETTE` centralizes blue-slate shadows, desaturated masonry, sodium lighting, institution colours and district temperatures. The existing sky/fog, voxel materials, building signs/windows, baked glow, lighting, clothing trim, holo ads and HUD now use these choices where applicable. FCN uses signal red on its screens and tower; the Bureau uses slate grey; objective markers and active player controls use gold.

Building neon probability is reduced, and animated holo saturation drops from 0.85 to 0.51. Holo hue oscillates within a narrow district band instead of traversing the hue wheel. ACES tone mapping retains readable night surfaces. Night no longer receives the old below-horizon sunset bloom.

Reproduce the screenshots with `FC_COMPARE_PHASE=before|after npm run compare` in `_test/` (capture `before` on the prior palette). The committed harness uses the same `hd-compare` seed, Civic Core camera, HIGH tier and 1280×800 viewport at 18:00 and 23:00. Images and category-isolation frames are in `_test/out/`.

## Dialogue and writing

Confirmed the previous failure path: ordinary `shSay` was redirected into `Narr`, where a scene could queue behind ambient district speech; `shCampaignSilence` cleared that queue and its callbacks. Timed beat callbacks added a second ordering mechanism.

Prologue scene speech now has its own `FN.scene` state and persistent dialogue panel. The world holds until N or the visible pulsing Continue button acknowledges each line. Every line names the speaker and role, location and next action. The objective updates before scene entry. Other narration sources and tutorial toasts are discarded while the prologue is active, including the year-later transition; head barks remain non-blocking.

`FN_BEATS` is an ordered sequence of scene/action steps with explicit entry and exit conditions. Entry is recorded once, stale callbacks cannot advance another step, and card handlers accept a single selection. Scene progression no longer uses timer chains. The camera and clock are synchronized before the opening pause. All prologue speech, street/reaction bark pools, choices and class-specific case openers are rewritten in the requested register, without em dashes. Ned's 17:58 pre-roll now agrees with the clock; the year-later wall broadcast is identified as a recording.

## Verification

Required release commands: `npm run boot`, `npm run campaign`, `npm run first-night`, `npm run web`.

The browser flow acknowledges each scene through alternating N presses and real button clicks, injects district/ordinary narration and tutorial toasts throughout the prologue, checks scene persistence through campaign silence, visits all ten steps in order, makes all three decisions, takes the crowbar, fights the looters and enters the first campaign movement. Grounding checks cover a real Warden crossing a voxel kerb, escort, freeze, heat and Hook. Existing class, weapon, civilian, witness, save/restore and deployed-build checks remain.

No push or deployment. Existing personal data and saves are excluded from the commit.

## Residents and third person

The shared cast now uses an anatomical MakeHuman CC0 head mesh, fitted clothing, articulated elbows and knees, more restrained street clothing colours and adult proportions. The resident editor has a live, rotatable 3D preview, face close-up, face/frame controls, eye colours, four jacket cuts and four coordinated wardrobe palettes. Existing skin, hair, headwear, props, build and saved-avatar controls remain available.

V and the on-screen view button toggle third person. The camera retracts at voxel walls, preserves the combat aim ray, restores the eye camera between renders, and keeps driving/cinematic cameras intact. The selected view persists locally. See `apps/fracture-city-game/RESIDENT-STUDIO.md` for controls, limits, asset provenance and verification. The added browser test passes fourteen checks covering editing, persistence, rendering, camera clearance and aiming.

## Hostile cast and physical arcade follow-up

Zombies, stalkers, spitters, howlers, husks, thugs and heavies now use the detailed resident anatomy and articulated rig. Infected faces receive restrained discolouration, with distinct body proportions, posture, throat/back growths and armor. Enemy health, tactics and collision bodies remain unchanged; damage-flash materials are isolated from civilians.

The arcade now owns its furnishing state per loaded chunk. Destroying its chunk clears stale hotspots and the old global furnishing flag, allowing all nine cabinets to return on the next visit. Cabinet models have shaped shells, recessed screens, marquees, control decks, buttons, joysticks and coin doors. Their screens use captured title/entry screens from the installed apps, with the existing E-to-play embedded app flow. Captures are static attract screens, not nine simultaneously running games.

`node _test/enemies-arcade.test.js` passes sixteen integration checks: all seven enemy rigs, health/grounding/material isolation, nine cabinets and screenshots, idempotent furnishing, three unload/revisit cycles, collision-free interaction spots and opening/leaving Palm Drive. The four required release suites also pass.
