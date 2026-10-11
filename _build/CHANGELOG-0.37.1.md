# Fracture City 0.37.1

## Playable changes

- Each of the five chapters has its own field action: breakers, radio tuning, carrying a battery, identifying the Bureau’s record, and rerouting transmitter feeds.
- The journal, chapter cards, launcher description and public community website follow the same one-night story. Website progress ends at chapter five; earlier story records are labeled separately.
- Checkpoint success reflects an actual successful save. Completed stations in earlier saves stay complete.
- Enemy wind-ups precede melee damage. Moving out of reach avoids the committed attack; a hit can interrupt it.
- Characters animate knees, elbows, torso and riding posture. The skateboard is a world-space 0.84 m deck. Distinct weapon models attach to hands; first-person hands and sleeves follow customization. Umbrellas use an upright hand attachment and gripping fingers.
- Cached weapon geometry, cached head geometry, staged mall population and distant animation/shadow limits reduce repeated work.

## Validation and limitations

The accelerated full campaign completed 31 checks, including the ending and checkpoint recovery. Focused campaign checks passed 12 assertions. Motion checks verified limb movement, deck dimensions, hand attachments and umbrella orientation without browser exceptions. Broader regression checks passed: startup 21, customization/camera 14, enemies/arcade 16, world 32, prologue/systems 65, and standalone build 17. All 14 equipment states, construction visibility and appearance refresh also passed.

A single-machine Chrome profile at 1280×800, balanced quality, sampled six seconds at three fixed locations. The baseline transition sample had a 633 ms maximum frame; the final cached-equipment sample had an 83 ms maximum and 33.4 ms 95th percentile. Ordinary street motion had a 16.8 ms 95th percentile. These are short samples, not a hardware guarantee: transition hitches remain, and ongoing streaming is not yet consistently within a 16.7 ms frame budget.

The residents and equipment remain procedural, stylized models. This release improves articulation, scale and recognizable equipment; it does not constitute a photorealistic character asset replacement. No external newcomer playtest has been performed. Use apps/fracture-city-game/PLAYTEST.md for that next validation step.

The Present Palm launcher loads this source folder directly. Reopen the game to use the updated scripts. No ChatGPT connection is required. The standalone beta is built with the sample cast and no analytics key.
