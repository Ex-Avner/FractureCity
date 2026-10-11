# The Outbreak

Story rewrite. Unversioned; rides on 0.36.1. Story bible: `apps/fracture-city-game/OUTBREAK.md`.

## Story
- New plot. Ned is FCN's automated anchor. At 17:58 he throws an error, everyone hears a different sentence, and one hundred people turn.
- Prologue rewritten: the looters are now the first of the Turned, Ned throws the error on screen, and the night continues straight into the campaign (no "one year later").
- Five chapters replace the twelve movements: The Clock, The Voice, The Memory, The Form, The Six O'Clock. One citizen repairs one part of Ned in each.
- The Bureau stays: its test file caused the error, and its Wardens observe Chapter Four.
- Ned's best lines from the old script are kept or adapted. All quarry references are gone from anything a player sees.

## Play
- Each chapter: reach the station, defend the repair, put down exactly twenty of the Turned. One hundred in all, counted under the clock.
- The repair pauses when you walk more than 22 m away or the Turned reach the station; the HUD says which.
- No ambient infected spawn during the story, so the count is exact.
- Ned comments during fights in a small non-blocking ticker.
- The free-play job panel is hidden while the story runs.

## Renames
- Quarry Hand is now Utility Hand. Quarry Pick is now Sledgehammer. QUARRY MODE (build) is now SALVAGE MODE. Internal keys unchanged.

## Fixes
- The Turned had no `height`, so the resident body builder scaled them by NaN (console geometry errors). Set to 1.8 m when the story or the prologue registers them.

## Saves
- An old campaign save restarts at Chapter One, with the city kept.

## Tests
- `_test/outbreak.test.js` (`npm run outbreak`): 31 checks, full playthrough.
- `_test/first-night.test.js` updated for the new prologue lines: 65 of 65.
