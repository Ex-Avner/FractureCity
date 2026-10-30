# Fracture City 0.90.0: One Look

Finishes what 0.89 started: the look now has one owner, and the props that still read as untextured boxes have surfaces.

## One look table

Six passes used to write the lights, fog and exposure every frame, each scaling or overwriting the last: the base rig, the sky's daylight pass, the visual-cohesion palette, the HD fog multiplier, the sodium grade and Real Light. Half those writes did nothing. The HD tier's fog multiplier was overwritten a few lines later, and the sky's exposure easing was overwritten by the palette pass.

`FCRealLight.look(hour)` now sets every value outright: sun, hemisphere, ambient, rim, neon fills, fog colour and density, and exposure. It works from the clock, the weather cover, the day's weather, the tier and your brightness setting. The older passes no longer touch any of these; about 140 lines were removed. The values you see are written in one table.

- The night key light now comes from the moon. Before, it came from the sun's position below the street, so the city was lit from underneath.
- The tier fog setting works again: Ultra sees further, and Performance hides the streaming edge.
- First Night's quiet minute still dims the city. Before, the palette pass overwrote it on the next frame.

## Surfaces

- **Wear.** A small surface shader adds two-scale mottling to colour and roughness. It is used on the first-person weapons and hands, the arcade cabinets, and Common Ground's stone, paving, bronze and wood. It needs no textures or UVs, and the pattern sticks to the object as it moves.
- **Cabinets.** The side panels are now deep lacquer in each game's colour instead of flat bright plastic. The glowing edge strips carry the colour.
- **First-person kit.** The weapons and hands keep about a third of their old self-glow, so they sit in the scene's light instead of looking pasted on.

## Interface

The eight world prompts (Common Ground, News Hub, Reading Garden, the Seam, casting, NPC talk, art workshop, open call) and two corner widgets (the quest card and the Seam bar) now share one dark glass, one typeface and one corner radius. Each prompt keeps a thin accent line in its feature's colour.

## Merged: the Lantern Hall

This release sits on top of the Lantern Hall commits (`f8e2b50`, `0b06518`) and makes the hall and the look table work together:

- **Zones.** `FCRealLight.zones` lets an authored place claim the air and light while you are inside it. The hall uses it for its own dark interior fog. That fog used to be written before the look table ran, so 0.90 would have erased it. The vault now also keeps 80% of the sun out, so sun shadows no longer fall inside a closed room. Common Ground is an interior at every hour, by choice.
- **No hitch at the hall's edge.** The hall's four lights used to be hidden when you walked away. That changed the scene's light count, which made three rebuild about 30 lit shaders on the next frame, every time the hall appeared or disappeared. The lights now live outside the hall's root and fade to zero instead.
- **Foliage.** Real Light's crown pass no longer swaps out the hall's instanced leaves.
- **Sign.** The arrival sign reads "F R A C T U R E   C I T Y", with the gap between the words.

## Tests

`_test/real-light.test.cjs` now also checks that a frame leaves exactly the values the look table set, that the moon keys the night, and that the wear and the shared glass are applied.
