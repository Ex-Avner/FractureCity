# The wider world

Unversioned; rides on 0.36.1 and the outbreak story. Modules: `wilds.js`, `architecture.js`, `malls.js`, `street-life.js`.

## Drones
- None in the prologue or the outbreak chapters. The Bureau sends Wardens instead.
- Everywhere else: they glow, and show a red aiming line for 0.8 s before each shot. The shot lands where you were when the line went red, so stepping aside makes it miss.
- Damage 8 to 4, one shot every 1.6 s instead of 0.6, range 14 m, 24 HP.

## Wild biomes
- NUKE FIELD: scorched ground, craters with hot cores, dead trees, ruined houses, hazard signs, leaking barrels, and now and then a cracked cooling tower. Radiation builds while you stay; past 40 it hurts.
- BIOWASTE LAKE: sludge filling a whole superblock, outfall pipes, a sunken car, barrels, an island with a crate. Standing in it burns.
- THE OUTSKIRTS: everything past 9 chunks from the centre is wild, mixing nuke fields, lakes and scrubland with broken road, pylons and wrecks.
- In the city: about one superblock in eight, never within three chunks of the Civic Core. The rest of a saved city keeps its layout.
- Rare weapons in craters, towers and on the island. Hot slag is the most valuable salvage in the game.
- Radiation and biowaste meters, a Geiger click, and a green edge to the screen while you are dosed. Dying clears it.

## Shopping centres
- About one per six candidate 2x2 blocks, never side by side, never in the Civic Core or the wilds.
- Three floors around a skylit atrium with glass railings and a dry fountain; two stair runs; lit ceilings; 30 shop units with lit fascias, names, stock and tills; a food court and a cinema; four entrances with the mall's name.
- Keepers who pitch their shop, shoppers who walk the corridors, a guard. They appear when you are within about 75 m.

## Architecture
- Downtown: glass curtain walls, art deco setbacks with gold trim, spires.
- Residential: brick, tenements with fire escapes and water towers, pitched tile roofs.
- Forge: sawtooth roofs with north-light glass, brick chimneys.
- Flood Gate: blue-tiled lower floors, setbacks, masts.
- Night Market: pagoda roofs in lacquer red, lanterns under the eaves.
- Street level is untouched, so shops and doorways keep working. Roof props move to the new roofline.

## Street life
- Crowds: about a dozen people within sight by day, fewer at night, arriving and leaving out of view.
- Activities: chatting in pairs, phone calls, smoking, looking up, photos, jogging, busking with a small audience, arguments that sometimes become fights. Everyone runs from the Turned.
- Crimes about once a minute, one at a time, never during story fights: bag snatch, mugging, brawl, pickpocket (on you), car break-in, tagging. A red marker shows the culprit. Stopping one pays; hitting a culprit is not reported.

## Tests
- `_test/world.test.js` (`npm run world`): 32 checks.
