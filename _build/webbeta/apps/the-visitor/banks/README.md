# The Visitor — Local Image Bank

The Visitor will try this bank **first** before calling any generation API.
Drop your pre-generated images into the matching subfolders, edit
`manifest.json` so it counts them, and the app uses them. Otherwise it
falls back to the existing flow (Pollinations → AI Horde → upload-your-own).

## Folder layout

```
banks/
  manifest.json                  ← machine-readable count + file lists
  README.md                      ← this file
  apartments/
    dusk-warm/
      01.png
      02.png
      ...
    rain-night/
      01.png ...
    dawn-cold/
      01.png ...
    loft-late/
      01.png ...
    modest-bright/
      01.png ...
  visitors/
    lost/
      01.png ...
    witness/
      01.png ...
    returning/
      01.png ...
    bearer/
      01.png ...
```

Any filename works (the manifest lists them); the **folder names must match
the slugs** above.

## Recommended bank sizes

| Folder | Recommended count | Aspect |
|---|---|---|
| apartments/* | 6–10 each (30–50 total) | 1280 × 768 (wide) |
| visitors/* | 6–10 each (30–50 total) | 768 × 1152 (portrait) |

You can run with as few as 1 per folder; the app picks uniformly at random.

---

## Apartment prompts

Generate externally — ChatGPT-image, Midjourney, Leonardo, Bing Image
Creator, Stable Diffusion Online, anything that does painterly oils.

### dusk-warm
> Painterly oil painting of a small near-future urban apartment interior at dusk, view facing one wall from inside the room. Warm pooled lamplight from a single floor lamp on the left casts amber light across worn wood-paneled walls. A heavy wooden front door in the center-right of the frame with brass handle, small peephole, and faded scratches. A large window to the right of the door shows the silhouette of a Bladerunner-style cyberpunk megacity far below with blurred neon signs in pink and teal and gold, rain streaks on the glass, low fog. A small round table with a steaming teapot, a worn velvet armchair facing the door, a tall bookshelf on the left wall packed with old hardcovers, a faded woven rug on the wooden floor. Painterly brushwork in the style of Disco Elysium and Kentucky Route Zero. Moody, contemplative, melancholy near-future cyberpunk. Warm orange and deep umber palette with cool blue-violet from the window. Empty room, no figures. Wide cinematic composition.

### rain-night
> Painterly oil painting of a small urban apartment interior late at night during heavy rain, near-future cyberpunk setting. A dim room lit only by neon city light bleeding through tall windows on the right — magenta and cyan glow streaming through rain-streaked glass. A heavy wooden door center-frame with peephole and chain lock. Dark wallpaper, scuffed parquet floor. A low table near the window holds a closed leather notebook and a teacup. A leather armchair turned partway toward the door. A standing brass coatrack in the corner. Painterly brushwork like Norco and Disco Elysium. Wet, atmospheric, melancholy. Cool blue-violet shadows, warm magenta highlights, deep umber midtones. Empty room, no figures. Wide cinematic composition.

### dawn-cold
> Painterly oil painting of a small urban apartment interior at cold pre-dawn, near-future setting. Pale grey light filters through thin linen curtains. The apartment is sparse — a folded woolen throw across a low futon couch against the back wall, a teacup on a side table, a heavy door center-right with multiple deadbolts and a peephole. A small window to the left shows the distant city silhouette in flat early morning light, no neon yet, just grey on grey. Painterly brushwork like Kentucky Route Zero. Cold, quiet, contemplative. Pale blue and dove-grey palette with one warm sliver of light from a single bare bulb. Empty room, no figures. Wide cinematic composition.

### loft-late
> Painterly oil painting of a small urban loft apartment interior late at night, near-future cyberpunk setting. Industrial tall windows on both sides showing rooftops with distant club neon — pink and gold and teal — bleeding through. A stick of incense in a small dish on a metal table releases a thin curl of smoke. A heavy steel-reinforced door center-frame with peephole, slightly battered. Concrete walls, exposed pipes, a folded futon couch with a wool blanket against one wall. Painterly brushwork like Disco Elysium. Late, smoky, alive. Deep purple shadows, hot pink and amber highlights, the distant city visible as glowing atmosphere. Empty room, no figures. Wide cinematic composition.

### modest-bright
> Painterly oil painting of a small modest urban apartment interior in soft afternoon light, near-future setting. A lived-in space — mismatched wooden chairs around a small table, a potted plant by a window showing low rooflines and a few signs of city beyond, dishes drying on a wooden rack. A simple wooden front door center-frame with a peephole and a hook beside it where a coat hangs. Warm beige walls, warm wood floor. Painterly brushwork like Florence and Kentucky Route Zero. Quiet, ordinary, warm. Soft amber and dust-cream palette with green from the plants. Empty room, no figures. Wide cinematic composition.

---

## Visitor portrait prompts

Use this template, swap `{ARCHETYPE}` for one of the descriptions below.

### Base template
> Painterly oil painting portrait of {ARCHETYPE}. Fully clothed in long coat and layered clothing, modest dress. Standing in a dimly-lit apartment hallway at night, near-future cyberpunk setting. Warm orange lamplight catches them from one side (from the apartment doorway), cool blue-violet shadow on the other side. Slightly out-of-focus dim hallway behind them with a brass wall sconce. Half-body framing, facing slightly toward the viewer but not directly at the camera. Calm dignified expression. Painterly brushwork in the style of Disco Elysium and Kentucky Route Zero. Cinematic, moody, melancholy. Real human warmth in the face. Single subject, head and shoulders visible.

### Archetype descriptions (these match the in-game visitor kinds)
- **lost** — a tired middle-aged person with cropped grey hair under a knit cap, wearing a long worn overcoat, holding a folded paper in one hand, looking uncertain. They have the bearing of someone who has been walking the city for hours. Soft melancholy.
- **witness** — a young person in their twenties with sharp watchful eyes, short dark hair, wearing a high-collar raincoat zipped to the throat, holding their phone close to their chest like a shield. They have the look of someone who knows something they shouldn't.
- **returning** — an older well-dressed person with silver hair and slightly old-fashioned clothes, standing with their hands clasped in front of them. They have the patient sadness of someone who has been gone a long time.
- **bearer** — a practical-looking person in a hooded rain shell, holding a small wrapped parcel in both hands. Mostly in shadow except where the doorway light catches their face. They seem unhurried but uncertain.

---

## After you add files

Edit `manifest.json` — bump the counts and list the filenames. The Visitor
reads it on startup. Or run the included refresh helper from the in-game
Settings menu (rescans the folders).
</content>
