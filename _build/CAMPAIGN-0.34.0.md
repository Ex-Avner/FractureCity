# Campaign 0.34.0 — The Second Light

Implemented in the live Fracture City source; no deliberate changes to live save data.

- Fixed the dialogue/HUD function-name collision and extra intro animation-frame scheduling.
- Removed choice prerequisite deadlocks in movements eight, nine, and twelve.
- Enforced objective order and validated distinct authored evidence files.
- Added opening stakes, gold destination beacon, actionable bearings, and J casebook.
- Added loan-dependent morning reactions and an explicit Auditor witness interaction.
- Added FCN observation platform, up/down access, and sixty seconds of ceremony that wait for arrival and pause off-roof.
- Saved campaign choices and partial HOLD state per slot; recover interrupted choices and chapter-completion screens.
- Narration preserves pending completion callbacks instead of overwriting them.
- Web builder ships campaign-guide.js. Version is consistent at 0.34.0.

## Validation
15 Node-based campaign checks pass, including 54 full decision combinations through all twelve movements, actual save/restore functions using an in-memory store, narration completion callbacks, and parse checks. Run `npm run campaign` in `_test/`.

The static deployment build succeeds and contains every local script it references.
Browser automation exits before a window opens in this environment. No claim of completed visual, collision, performance, or human playtesting is made.

## Files
apps/fracture-city-game/index.html
apps/fracture-city-game/campaign-guide.js
apps/fracture-city-game/fracture.app.json
_build/build-beta.py
_test/campaign-flow.test.js
_test/package.json

The unrelated mesher extraction remains unapplied. No commits or deployment were made.
