# v0.69.1 — Return to Common Ground

- The death screen now offers “Return to Common Ground.” Solo respawn loads the district, resolves clear footing near the arrival promenade, restores health, stops movement, and faces the reading court.
- Online respawn first requests a server-approved fixed return point. Pose updates wait until the return finishes, preventing the movement-distance check from snapping the player back to the death location. A failed request leaves the death screen available for retry.
- The authenticated city-only return endpoint ignores supplied coordinates, rate-limits repeated use, advances the pose sequence, checkpoints the position, and broadcasts it. Main-city hazards remain locally simulated; this does not claim server-validated combat deaths.
- Timed server respawns and rejoining a saved dead city resident use the same city spawn. Arena respawns keep their existing protected-plaza location.

Validation: real-browser solo and online death-button flow, clear footing and restored health, continued online pose updates without snap-back, unauthenticated/lobby rejection, ignored arbitrary coordinates, return rate limit; server combat, city-online and Main Beta regression suites. No deployment performed.
