# Fracture City 0.26.2 — the menus were never an input bug

*"MENUS still not working on mobile version."* Third report. First time anyone
tapped one in a test.

## What it actually was

Measured on a landscape phone, with the menu on screen, drawing correctly, at
the top of the stacking order, receiving pointer events:

```
  viewport                     980 × 453
  #menu-overlay content        532px  in a 453px box
  overflow-y                   visible          ← the whole bug

  front-profile   y=101   on screen
  new-campaign    y=177   on screen
  new-free        y=271   on screen
  shift           y=365   on screen
  ALL SAVES       y=476   79px PAST THE BOTTOM OF THE SCREEN
```

The overlay is `display:flex; align-items:center; justify-content:center` with
no overflow rule. Content taller than the viewport is not scrolled — it is
**clipped**, and centring clips it at both ends, so "add a scrollbar" is only
half a fix.

On that phone the player could not reach their save list. On a smaller one, the
buttons above it go too.

## Why three passes missed it

Section 56 built a busy-list of "a panel is up" flags. Section 60 found a
z-index tie and moved looking onto the canvas. Both were real faults and both
were fixed. Neither was this.

Every check written for mobile menus across those passes asked whether a menu
was **visible**, **on top**, or **receiving pointer events**. All three were
true of a button 79 pixels below the bottom edge. `touchtest` has thirteen
checks and not one of them taps a menu — it tests the stick, the look drag, the
action buttons, and the z-index of a panel.

The new suite does not inspect anything. It **taps**, with a real
touchstart/touchend pair, and then asks whether the thing the button is for
actually happened.

## The fix — two halves, because either alone is half of it

**Make it fit.** A short viewport gets a compact menu: the title drops from
68px with 22px of letter-spacing to 30px/9px, the subtitle shrinks, rows
tighten, and the footer — which explains how to lock a mouse pointer, to
somebody holding a telephone — is hidden. Scrolling a six-item menu is a fault
to avoid, not a feature to add.

**And make it scroll anyway,** for the cases where it still will not fit: a
long save name, a large font size, portrait, a language that runs long.
`justify-content: safe center` keeps the menu centred while it fits and stops
centring the instant it would clip; a measured `.sh-overflowing` class does the
same job on engines without `safe`. Re-measured on resize, on orientation
change, and whenever a watched overlay's contents change — the front menu
rewrites itself when you move between home and the save list, and a longer list
is exactly when this matters.

Applied to all seven full-screen card overlays, not just the one reported:
menu, minigame, inventory, shift, death, and the two class-select wrappers.

## The check that was missing

`shFitUnreachable()` — is every control **on the screen**, or reachable by
scrolling to it? Not visible, not on top, not clickable: *on the screen.* It is
in the game rather than only in the suite, so any future panel can be asked the
question:

| viewport | unreachable controls |
|---|---|
| 844×390 landscape | 0 |
| 667×375 small landscape | 0 |
| 390×844 portrait | 0 |

## Suites

`menutest` **7** (new — taps, rather than inspects) · `betaA` 12 · `betaB` 7 ·
`flowtest2` 13 · `fittest` 13 · `depottest` 10 · `squaretest` 10 ·
`touchtest` 13 · `betabuildtest` 10 · `teltest` 11 · `gatetest` 7 —
**113 checks, all passing.**
