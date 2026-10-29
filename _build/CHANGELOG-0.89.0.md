# Fracture City 0.89.0: Real Light

One look for the whole city. Four systems used to paint over each other; `real-light.js` is now the last word on the frame.

## What changed

- **Air.** Fog now thickens toward the ground and thins with height, patched into three's own fog chunks so every material gets it. A street fades into haze at its far end; a rooftop view stays crisp.
- **Skyline.** The two old horizon rings are gone. The fogged one stood in front of the dark one, which is why the horizon read as beige cardboard. They are replaced by one camera-following ring of about 230 towers in three depth layers, with setbacks, crowns and masts, and a downtown that peaks in one direction. The towers share the near city's window rhythm and are lit by the same sun. At night a share of their windows light up, and at dusk they hold as silhouettes.
- **Daylight with a direction.** The sun does more of the work and the flat fill does less, so shapes turn and shadows read. The golden hour warms. Nights stay sodium.
- **Weather, not filters.** The daily off-colour skies (bile, bruise, rust) are now weathers a real city gets: Clear, Summer Haze, Overcast, Smog, Marine Layer, Golden, Cold Front. A room online still shares the day's weather.
- **Grade in the composite.** The full-screen CSS film is retired. The bloom composite now grades the frame: cool shadows, warm highlights, saturation roll-off, a gentle S-curve, a soft vignette and fine moving grain. The grain keeps moving under the Soundstage. The Performance tier gets a CSS vignette instead.
- **Trees.** Smooth single-sphere crowns become clustered, faceted canopies with a lit top and a shaded underside.
- **HUD.** The Common Ground world prompts now use the same dark glass as the rest of the HUD.

## Switch

Display panel (F) has a new **REAL LIGHT** toggle. Off restores the old horizon, crowns and grade.

## Tests

New: `_test/real-light.test.cjs`.
