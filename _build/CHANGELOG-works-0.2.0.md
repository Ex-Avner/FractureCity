# The Works 0.2.0 — the reader, and the mirror that puts itself back together

## What was wrong

The Works was a good gallery with a book bolted to the side of it. Clicking the
centre shard gave you a flat `<ol>` of thirty-two titles; clicking a title
dumped the whole chapter into a 44vw side panel with a "BACK TO CONTENTS"
button at each end. That is a catalogue surface, and the thing inside it is
**34,221 words of literary prose**.

Which meant, concretely:

- No way to know where you were, and no way to get back to it. Close the panel
  mid-chapter and you had lost your place permanently.
- No way to get from chapter seven to chapter eight without going out to the
  contents and back in.
- No search across 34,221 words. No marks. No type size. No keyboard at all.
- No sense of the book as a thing you were making progress through.

And underneath that, `index.html` pulled three.js and its four addons from
`cdn.jsdelivr.net`. That is the exact failure class that killed the game's main
menu in 0.16 — one missing file and the page is a blank veil with no
explanation.

## What is here now

### 1 · three.js is local

`shared/vendor/three/` now carries `three.module.js` plus the five addon files
the page actually imports (OrbitControls, EffectComposer, RenderPass,
UnrealBloomPass and their transitive `Pass`/`ShaderPass`/`MaskPass`/`CopyShader`/
`LuminosityHighPassShader`). The importmap points at those. The dependency graph
is closed — nothing reaches off-origin.

The test proves it rather than asserting it: every request that is not
`localhost` is **aborted at the network layer**, and the page still comes up.

If the vendored files ever do go missing, a boot check writes a sentence onto
the veil saying which file it could not find, instead of leaving you looking at
a loading bar forever.

### 2 · A real reader

Its own full-bleed layer, its own measure, its own keyboard.

| | |
|---|---|
| **Resume** | Scroll position is written continuously. CONTINUE on the contents page is the first thing you see and puts you back on the same line. |
| **Turn pages** | `←` `→`, or the buttons, which grey out at the two covers. Every chapter ends with the next one as a card. |
| **Progress** | Hairline bar across the top of the chapter, percentage in the footer, per-chapter state on the contents page (read / part-way / untouched, with word count and reading time). |
| **Search** | One linear pass over all 34,221 words — faster than the index it would take to avoid. Results grouped by chapter with the hit highlighted in context; clicking one opens that chapter and flashes the paragraph. |
| **Marks** | `B` marks whichever paragraph is nearest the middle of the screen. Marks are listed on the contents page and click through. |
| **Type** | Five sizes, three column widths, both remembered. |
| **Keys** | `Esc` `←` `→` `Space` `PgUp/PgDn` `Home/End` `j` `k` `b` `m` `+` `−` |

A chapter counts as **read** when you reach the end of it, not when you open
it. Chapters too short to scroll — there are a few — need four seconds on
screen instead, so the count means something.

### 3 · Reading reassembles the mirror

This is the "progressive expansion", and it is the part the book earns.

*The Collapse of Meaning* is about a fractured mirror. So the book's shard is
cracked in **thirty-two places, one per chapter**, and every chapter you finish
fills one of those cracks with **gold**. Not erases — fills. The seams stay
visible, brighter than the surface around them, because the book does not end
in a repair and neither should the object.

- The cracks are deterministic, so chapter seven's crack is in the same place
  every visit. "Chapter seven closed" can only mean something if it does.
- The shard glows fractionally brighter the more of it is gold.
- The bottom-right chrome reads `mirror 34% restored · 11/32 seams`.
- Milestones at 8, 16, 24 and 32.
- The cover in the panel is now painted by the same function at the same
  resolution as the shard in the room, so both show the same seams.

## Bugs found and fixed on the way

- **Turning a page inherited the last page's scroll.** Leaving chapter six at
  the bottom and opening chapter one landed you at chapter one's bottom — and
  the progress tick then marked a chapter read that you had not looked at.
- **A restore into a mid-transition panel lands on the wrong layout.** Setting
  the scroll after a fixed number of frames worked in isolation and failed
  under load. It now keeps putting the scroll where it belongs until it stays
  there, and refuses to count anything as read until it has.
- **Repainting the shard reshuffled the whole cover.** The brushwork is full of
  `Math.random`, so re-running it on every finished chapter quietly repainted
  the picture. The base painting is now done once and kept; finishing a chapter
  moves one crack and nothing else.
- **The drop cap shoved the second paragraph out of the column** whenever a
  chapter opened on a short line — chapter six opens on "The folding chairs
  were cold." The cap is now earned by length, not by position.
- **The top nav read straight through the panel** at 0.94 alpha and looked like
  a rendering fault. The nav gets out of the way instead.

## The tests

`workstest.mjs` — 17 checks, all passing. The two worth naming:

- *the page comes up with no internet at all* — off-origin requests aborted, 0 attempted.
- *the mirror repaints — the gold is actually on the texture* — counts warm-bright
  pixels on the canvas itself: 806 with nothing read, 29,526 with all 32 seams
  filled. Asserting on the pixels, not on my own comments about them.
