# Fracture City 0.77.0 · Common Ground arcades

## Added
- Five stand-alone arcade cabinets spread across the Common Ground campus,
  each with its own screen art, lit trim, sign and solid collision. Walk up,
  press E (or tap the prompt on a phone), play, Leave Cabinet returns you to
  the same spot. They are not in the arcade building's roster.
  - Toilet Heads HD: endless toilet jumper. East court, x 200, z 26.
  - Fractured Mirror: draw loops, your reflection draws them too. East of
    the water garden, x 210, z 38.
  - Breaking Ned: one-tap flyer, spell the headline, go live. West of the
    garden, x 148, z 27.
  - Oh No Ned: slingshot physics against living trash. South lawn, x 176,
    z 50.
  - Bad Weather: build a town, then watch the disaster hit. South lawn,
    x 166, z 56.
- Each game is its own app (apps/toilet-heads, fractured-mirror,
  breaking-ned, oh-no-ned, bad-weather) and is on the server's app
  allowlist and in the Netlify build.
- Clear my pieces here: removes your own furniture and art in the building
  plot you stand in (or within 6 m outside the plots). Whole groups go
  together. First tap arms, second tap clears, Undo brings it back. Other
  residents' pieces stay; the message says how many. In the online panel
  (Clear my furniture here) and in the art editor.

## Fixed before shipping
- The games loaded Google Fonts and Oh No Ned loaded matter.js from cdnjs.
  The city server's content policy blocks both, so Oh No Ned would not have
  run in the city. The fonts (SIL OFL 1.1, from Fontsource) and matter.js
  0.19.0 (MIT) are now bundled with each game. No game makes an outside
  request; each runs offline.

## Known
- The city page's news ticker still tries to reach Hacker News, which the
  server's own content policy refuses. Harmless, but it logs errors.
  Unchanged in this release.

## Tests
- _test/campus-arcades.test.cjs, through the real server: all five served
  with no outside dependencies; each cabinet placed once, solid, on open
  ground with a clear approach; E opens the right game; its fonts load
  locally; matter.js loads for Oh No Ned; Leave returns to the cabinet; the
  arcade building roster is unchanged; a chunk reload restores one cabinet;
  Clear my pieces here arms, clears Plot 01 including whole groups, leaves
  pieces outside, and undo restores; every game fits a phone; no outside
  requests, content-policy blocks or browser errors.
