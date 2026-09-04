# Fracture City 0.23.0 — the square, the news, the phone, the zip

## 55 · The square, rebuilt

The town square was four boards on posts on a flat slab. Everything true about
it was in the *writing* — civic infrastructure nobody switched off, still
receiving from a world that does not know anyone is left reading — and none of
it was in the geometry. You walked into a car park with televisions in it.

So it is rebuilt around the one image this whole project is about. *The Collapse
of Meaning* is a book about a fractured mirror. The Works is a gallery of
shards. The city is called Fracture City. **And the one place the city gathers
had no mirror in it.**

- **A cracked reflecting pool** in the middle, 10×10, flush with the paving, with
  glass seams running across its face. You stand ankle-deep in a broken mirror.
- **Six boards, not four**, on a hexagonal ring, each on its own raised pad.
- **Inlaid light**: every board's colour is laid into the paving and runs from
  its pad down into the pool. At night the square is six coloured rivers feeding
  one broken mirror.
- **The mast**: a civic obelisk out of the water with a four-sided lit crown
  carrying the freshest thing anybody said, readable from the next district.
- **A gantry** — four masts with catenary lamp strings between them, because
  every civic space anybody ever loved had something over your head.
- Halos behind each board, light shafts down onto the pads, and the mast doubles
  as the tuner.

## 55 · More kinds of news

Four Mastodon timelines was one source wearing four hats. **Fourteen channels
across four kinds**, and every one is readable from a browser on another origin
with no token — the only test that matters, because the web build has no main
process to proxy for it.

| | |
|---|---|
| **Mastodon** | public + eight tags — ai, gamedev, cyberpunk, art, music, science, photography, news |
| **Hacker News** | front page and Ask, via Algolia's one-request search API |
| **Bluesky** | the public AppView, no auth for public search |
| **Wikipedia** | recent changes — `origin=*` is the documented CORS opt-in |

Wikipedia's is the one I'd keep if I could only keep one: the public record
being quietly amended all day by people you will never meet, which is the
Bureau's business model described by somebody honest.

**A picker on the mast** assigns any channel to any board, persisted. A board
that cannot reach its source says NO SIGNAL — it never invents a post.

## 56 · Touch

There were **exactly zero** touch handlers in this file. On a phone the game
booted, drew the city, asked you to click to aim, and sat there forever.

The design bet: this does not reach into the movement code and set flags, it
**synthesises real key events**. A thumb on the stick fires the same `keydown` a
finger on W fires, through the same listener, into the same Set. So the
skateboard on Shift+S, E advancing Ned's narration, B for construct mode and
Escape closing a panel all worked on a phone the day it was written, with no
second input path to keep in step. Only looking is direct, because mouselook is
deltas rather than keys.

Stick bottom-left with a dead zone, diagonals and sprint at the rim; drag
anywhere to look; FIRE / E / JUMP / PLACE bottom-right; BOARD / BUILD / ITEMS /
MAP / MENU along the top; a portrait nudge; and `State.ui.locked` held true by
hand, because there is no pointer to lock.

## The beta zip

`fracture-city-beta-v0.23.0.zip` — drop the unzipped folder on Cloudflare Pages
or Netlify and it plays. Game, vendored three.js, `_headers`, `_redirects`,
README. No build step, no bundler, no CDN.

Verified by serving the zip's actual contents from a plain static server with
every off-origin request refused: boots, builds a world, saves through
localStorage, survives a reload, and comes up on a phone with controls.

## Bugs found

- **The plaza left the last column of its own chunk unpaved** — a one-block
  trench on the boundary that read as a two-block drop from the east. A rise of
  two is not a step; this city has been audited for exactly that before.
- **The pool sat a block proud of the paving.** You stepped *up* onto the water.
- **The entrance gaps were cut by a loop that laid a block and cleared it on the
  next line**, so they were never cut at all. Replaced with six pads and a flat
  floor, which has no continuous edge for the fault to live on.
- **Landmarks build before their chunk is in the map**, so `setBlock` looks the
  chunk up, fails to find it and silently writes nothing. Everything in the
  square goes through `stampBox`. Same trap as the fittings pass, from the other
  side.
- **The touch layer rode on the HUD tick**, which does not run while a modal
  panel is up — exactly when the controls most need to get out of the way. They
  stayed on top of the inventory eating taps, and kept holding whatever key the
  thumb was on. It has its own animation frame now.
- **`setPointerCapture` can throw**, and a throw in `pointerdown` left the stick
  dead. Made non-fatal.

## Two tests that were lying

**The keyboard legend.** The touch CSS hid `#hud-help` — an id that is not in
this file. So it hid nothing, the legend sat across the JUMP button on every
phone, and the test agreed everything was fine because
`getElementById` returned null and the test read that as "hidden". It asserts on
`#hud-controls` now and requires it to *exist*.

**The movement test.** The stick held W and the player travelled 0.00m, which
looked like a broken stick. Adding a keyboard control — press a real W, measure
the same thing — showed a real W also moved 0.00m: the harness had dropped the
player on an apartment *roof*, where walking forward walks into a parapet. The
test now stands in the town square. **A movement test run against a wall
measures the wall.**

## Suites

`squaretest` 10 · `touchtest` 13 · `betabuildtest` 9 · `fittest` 13 ·
`depottest` 10 — 55 checks, all passing.
