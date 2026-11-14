# Common Ground: Crown Run

A physical parkour route follows the front Lantern Hall arch from the western foot, up to the 99 m crown, and down to the eastern foot. Enter at the CROWN RUN sign on the street-facing side (approximately x144, z−12). Walk onto the starting pad; no quest menu is required. Jump toward the mint ring. Existing keyboard and mobile jump controls apply.

274 stone footholds use the same authored bounds for rendering and collision. Bronze outriggers connect them to the front rib; mint edge strips and gold checkpoint pads distinguish the route. Land on each next pad to advance. Checkpoints occur every twelve pads and at the summit. A fall of more than four metres below the current pad returns the player to the last checkpoint. Leaving the course, entering custody, driving or activating flight ends the attempt. Completion lights the course and enlarges the finish ring; a short notice reports time and catches. Runs are session-local, with no server writes, credits or competitive leaderboard.

The route samples both the vertical and horizontal changes of the ellipse, with a winding offset that provides headroom between successive turns. It does not require sprint, flight or class upgrades. The front arch is 99 m high; the rear 193 m vault is not part of this route.

Platforms, edge strips and structural outriggers are instanced. No additional lights, shadows, physics bodies or network timers are introduced. Authored clearance is generated before saved voxel edits, so existing player builds remain authoritative and can obstruct a route. Generated chunks receive the collision blueprint before rendering. Scene changes dispose of course geometry, materials and textures.

Validation: `_test/crown-run.test.cjs` exercises all 273 transitions through the game's actual collision and landing routines using a 7.5 m/s jump and no more than 5.5 m/s horizontal movement. It separately verifies ordered progression, skipped-ledge rejection, checkpoint recovery and completion. Automated coverage is not a substitute for a full human playthrough or physical-phone testing.
