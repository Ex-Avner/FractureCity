# 0.17.0 — THE SKY

Also in this release: the fix for the dead main menu, and why it happened.

---

## First, the thing that broke

**The menu drew perfectly and none of its buttons did anything.**

The web build of Fracture City vendors three.js at `shared/vendor/three.min.js`.
The desktop build was loading it from a CDN. I shipped 0.16.0 by copying the web
build's file over the desktop one, so the desktop app started asking for a path
that did not exist on that machine. `THREE` was never defined, every handler
behind the front door threw on its first line, and the result was a main menu
that rendered correctly — because it is HTML and CSS — and was completely inert.

That is the worst way for a missing file to present itself. It does not look
like a 404; it looks like the game is broken.

Two fixes:

1. `shared/vendor/three.min.js` now exists on the desktop, byte-identical to the
   copy the web beta ships (sha256 `3b3a1c97…`). Fracture City no longer touches
   a CDN at all.
2. The page now falls back to the CDN if the vendored copy is missing, and if
   *neither* is reachable it says so on screen instead of showing a menu whose
   every button is dead. `vendortest.mjs` covers both paths, including serving
   the script a deliberate 404.

---

## The sky

The city had a complete day-night cycle: twenty-four hours of gradient stops, a
sun that crosses, a moon opposite it, eight hundred stars. What it did not have
was a sky. Four separate things were wrong, and only one of them was colour.

### It was inside the fog

This is the one that mattered. The sky dome is a sphere of radius 380 sitting in
a scene with exponential fog on it. At this city's density that is a fog factor
of **0.94** at the dome's surface — nineteen twentieths of every sky pixel was
being replaced by one flat colour, whatever the gradient underneath said.

That is why every hour looked like a wash. It was not the palette. The palette
was never visible.

### It was black, not blue

Night bottomed out at `#020108` — two parts in a thousand off pure black — and
the magenta ran from dusk right through until dawn. The new table never goes
below a navy, and the horizon keeps a band of the city's own glow in it all
night, because a city lights its own sky and the horizon of one is never the
darkest part of it.

### It was banded, not lit

The gradient was purely vertical, so every point at a given height was the same
colour regardless of where the sun was. The sun could sit on the eastern horizon
while the west was exactly as bright.

Every vertex now gets three more terms: how close it is to the sun, how close to
the moon, and how close to the city under it. And the warm colours came *out* of
the palette table and went into the sun's own bloom — a table that paints the
horizon orange at sunset paints the whole horizon orange, including the quarter
of the sky the sun set ninety degrees away from, which reads as a filter over
the lens rather than as a sunset. Measured: the sunward horizon is now 1.30× the
luminance of the opposite one. It used to be 1.00×.

The sun also stopped going through the zenith. Its elevation was a plain sine of
the hour, so at noon it was directly overhead — blooming the one part of the sky
that should be its deepest blue, and putting every shadow in the city directly
underneath the thing casting it. It now peaks around sixty-five degrees and
leans south, so it crosses the sky instead of climbing a ladder up it.

### Nothing in it moved

Two layers of cloud on their own domes now, drifting at different speeds (near
layer 2.6× the far one — parallax, not one sheet), lit by whatever colour the
sun is at that hour. Cover wanders between 5% and 95% on two sines with
incommensurable periods, so some hours are clear and some are not and you cannot
learn the pattern. Stars fade out under it. There is a sun disc that reddens and
swells as it drops.

All of it is generated at runtime — the cloud is value-noise fBm baked into one
canvas at boot and then scrolled. No assets.

### And the grade

ACES desaturates whatever it lifts, so the previous pass's fix for "too dark"
was making the blue grey. Worse, its exposure curve ran *backwards*: brighter at
midnight than at noon. Exposure is now 1.16 at night and 1.29 at noon, and the
brightness comes from the light rig instead — noon sun 1.37 and hemisphere 1.64,
against 0.10 and 0.42 at one in the morning.

---

## One bug worth naming

The first cloud layer shipped **completely invisible** and nothing reported an
error. The value-noise hash used plain `*` on 32-bit integers, which quietly
leaves integer space in JavaScript and comes back as a double with its low bits
gone — the hash's mean was 0.24 instead of 0.5. The alpha cut was at 0.44. Every
pixel came out fully transparent.

It is `Math.imul` throughout now, and the cut is no longer a guess: the field is
built first, then the threshold is read off its own distribution at the
percentile that gives the coverage asked for. `shCloudCanvas(seed, 0.34, …)`
produces 34% cloud, measured.

---

## Verification

- `skytest.mjs` — 12 tests, green. Reads the painted dome back vertex by vertex
  and asserts in sRGB, because a `#050c26` navy is 0.0015 in linear and a test
  that asserts on that is asking the wrong question.
- `vendortest.mjs` — 2 tests, green. Clicks through the real menu, and serves a
  404 to check the fallback.
- `skatetest.mjs` 20, `flowtest.mjs` 6, `betatest.mjs` 13, `feeltest.mjs` 16 —
  all unchanged and still passing.
