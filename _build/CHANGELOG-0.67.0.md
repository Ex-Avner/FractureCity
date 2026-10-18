# 0.67.0 · Skate lines

- Removed random street kickers. Their generation hook now emits nothing, including when called by older modules.
- Replaced overcrowded park layouts with three bounded, lower obstacle layouts: banks, transitions, and kickers/low rails. Ramps stay inside their 14m pads; entry banks connect to street height without occupying roads.
- Added a dependable Concrete Commons skate spot at chunk 8,0 (204,12), east of Makers' Mile and west of the Seam. The surrounding road ring stays clear. This replaces the procedural lot, outside the online building plots; ordinary saved voxel edits still apply afterwards.
- Charged ollies wait for Space release instead of automatically firing at full charge. Fixed doubled airborne time and ramp collision that pulled riders upward from well below the surface. Landing on a ramp now goes through normal landing checks.
- X: kickflip. Z: shove-it. Each has a timed deck animation; incomplete rotations can bail. Backward/fakie landings count, clean alignment earns a bonus, sloppy landings shed speed. Repeating a trick within a chain pays less.
- Hold C for a rolling manual, A/D to balance. Manuals bridge combos and score distance; standing still cannot score. Touch controls offer Flip, Shove, Manual and balance taps while riding.
- Park challenges combine a landed trick, a 2-second manual, and a grind. Bank the chain to complete the line. Park best scores are local per account username/world/spot, not a competitive server leaderboard.
- Third-person rider crouches further while airborne; deck animation returns to neutral after a completed trick.

## Validation
`node _test/skate-lines.test.cjs`: sixty layout fixtures across all three variants; no road kicker output; charge/release, fakie, unfinished flip bail, repeat discount, manual balance, single-count airtime; actual district streaming and screenshots; keyboard-driven ollie/kickflip/landing and touch manual controls.

No personal data changes, commit, push, or deployment included.
