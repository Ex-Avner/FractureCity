# Fracture City 0.27.0 — a clean front door, and the arcade told the truth

## The arcade was loading the game into itself (0.26.4)

`shPlayCabinet` reaches the other Present Palm apps by relative path:

```js
frame.src = '../' + slug + '/index.html';
```

In the shell that is `apps/palm-drive/index.html`. **In the web build there is
no `apps/` tree** — the deploy is index.html, three.js, `_headers`,
`_redirects`. The path climbs above the site root and `_redirects`
(`/* /index.html 200`) answers with **Fracture City itself**, so the cabinet
fills with a recursive copy of the game.

It failed silently, because the existing guard asked only whether the frame's
body had children — a nested copy of the game has plenty — so the "could not
load" panel never appeared. That is why it read as *"none of the arcade games
work"* rather than *"the arcade needs the desktop app"*.

The build now marks itself `FC_STANDALONE` and cabinets never point at an app
they do not have; they show an honest card naming the game instead. Separately,
the frame learned to recognise its own reflection, so anyone self-hosting the
folder without that flag gets the truth rather than a hall of mirrors.

## The front door

Before:

```
  FRACTURE CITY
  The Second Light · Present Palm · v0.26
  New Resident · @unresolved · resident of Fracture City
  ◈ NEW GAME — THE SECOND LIGHT  ·  start here
    Six movements over one night. Ned reads you in; the city does the rest.
  ▶ NEW GAME — FREE ROAM
    No story running…
  ◷ DAILY SHIFT — TWENTY MINUTES
    Twenty minutes, one evening, one unfinished thing…
  ▣ ALL SAVES
  Click a save or START, then click the canvas to lock the mouse.
```

After:

```
  FRACTURE CITY
  New Resident
  ◈  NEW GAME
  ▶  FREE ROAM
  ◷  DAILY SHIFT
  ▣  SAVES
```

**THE SECOND LIGHT stays everywhere it belongs** — the twelfth movement, the
ending, the chapter card, the save metadata. It is the name of the story, not
the name of the front door, and putting a story's ending on the title screen
was giving it away in the first sentence.

Done as a rule rather than an edit, because the menu rewrites itself between
home and the save list and section 49 re-dresses the buttons after every
render. The subtitle and footer are **emptied**, not just hidden — hidden copy
is still copy, in the page source and to a screen reader.

## Avner Media

Removed from every label across the project — the hub's brand line and footer,
`shell/package.json`, the root `fracture.json`, all sixteen app manifests, the
web landing page, and a book citation in the coherence assessment. Twenty files.

Left alone, deliberately:

- **`appId: com.avnermedia.present-palm`** in the electron-builder block.
  Electron derives the packaged app's userData directory from it; changing it
  orphans every setting the installed app has written. Change it when you next
  do a clean install, not in place.
- **"Ex Avner"** — a person's name, not a company label. It stays as the byline
  on The Works and as the performer on the Residue Room marquee, which is
  fiction.
- **`apps/works/DEPLOY.md`** — instructions for deploying to a real domain you
  own, not branding.

## Tests that changed with the requirement

Two `flowtest2` checks asserted the old front door: that the subtitle read
"The Second Light · Present Palm · v…", and that the campaign button said
"start here" with three explanatory lines under the modes. Both were removed by
request, so both tests moved rather than being deleted:

- the version check now scans **every drawn element** for a version string that
  is not this build's — which is how `v0.15` survived eight releases in the
  first place
- the copy check now asserts the front door is a title and four buttons with
  **zero** lines of copy under them, and that no ending is named on it

## Suites

`menutest` 7 · `interacttest` 8 · `gatetest` 7 · `betabuildtest` 10 ·
`betaA` 12 · `betaB` 7 · `touchtest` 13 · `flowtest2` 13 · `teltest` 11 ·
`squaretest` 10 · `fittest` 13 · `depottest` 10 — **121 checks, all passing.**
