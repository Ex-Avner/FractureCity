# The Civic Walk

Three connected, physically entered spaces for culture, mystery and company.

## Find it

West of Common Ground, the Church of Omnism’s east forecourt has a Civic Walk directory (112, 19). Enter the church for the paired lanterns at (102, 20). Walk north across the street to the two large signed doors: the Mnemonic Archive on the left (86, -9), Resonance House on the right (106, -9). E or the context button opens the nearest activity. Close/Escape returns control; no extra permanent HUD buttons.

## Church expansion

The original octagonal sanctuary, dome, twelve reading stations and library remain. A new bronze-and-stone threshold, suspended constellation, concentric illuminated rings and paired intention lanterns enrich the interior. Choose Remember, Welcome or Begin Again to recolor the two lanterns. Four reading journeys open actual existing Greek, Norse, Taoist or Buddhist works; the full library remains accessible. The reflection is explicitly fictional, not a representation of an established religious rite. Existing source attributions remain unchanged.

## Mnemonic Archive

16 × 32 metre ground-level hall, floor elevation 2; walls to 10; repeated stone vault ribs rise approximately 19. Bronze shelving, a linear skylight and three deliberately fractured crown stones form the silhouette. The rings are now an architectural sculpture. The Archive opens Free College: a complete introductory critical-thinking course with lessons, assessments and a private investigation portfolio. See FREE-COLLEGE.md. The earlier ring puzzle has been retired. No currency rewards.

## Resonance House

16 × 32 metre ground-level salon with a folded limestone-and-bronze roof, rose-colored light strips, wall benches and hanging resonator pipes. Five playable pentatonic notes use short Web Audio envelopes triggered only by a button press. Conversation cards encourage gathering through the existing city chat. Audio, selections and discoveries are personal, not broadcast or multiplayer-synchronized; no microphone or recording. This is not a scheduled performance/NPC event system.

## Implementation and persistence

`civic-landmarks.js` owns generation for chunks 3–4 × -2–-1, preserving street rings and leaving the church, garden, Common Ground and player plot district intact. These four procedural blocks become authored public buildings. Existing user voxel overrides continue through the normal chunk-load machinery; no save records are rewritten or removed. Floor, walls, benches, shelves and consoles have physical collision. Upper architectural meshes follow the existing church convention: decorative roof geometry is not a new walkable level.

Box details batch into six material-based instance draws; other sculpture meshes are low-poly. No dynamic lights, extra shadow maps, network requests or per-frame storage writes. A 10 Hz proximity/presentation update handles visibility and puzzle poses. Geometry/materials/textures are disposed when the scene changes and reattached if a world reset clears the same scene. Sound stops when the activity closes.

Personal progress is stored under `fc-civic-v1:<world seed>` in browser localStorage after actions: visited places, intention, ring arrangement, unlocked memory and conversation card. It does not sync between browsers/accounts. Storage failure is reported after actions. New cultural blocks share the church's Ashbound sanctuary.

## Verification

`node _test/civic-landmarks.test.cjs`: grounded doors/floors, wall/console/bench collisions, church entrance, scene attachment, no new lights, six instance batches, Free College handoff, lantern choice, library handoff, audio cleanup, 390 px phone fit, persistence across reload. Screenshots cover the exterior, church, puzzle and phone salon. Existing Ashbound/library regression remains separate.

Deploy the pushed source through the normal hosting process; git push alone does not redeploy a host with automatic deployment disabled.
