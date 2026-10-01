# 071 — extract the greedy mesher

Not applied. `index.html` is yours; this is the patch for you to apply.

◆

## What it does

Moves the greedy voxel mesher out of `index.html` into
`apps/fracture-city-game/mesher.js`, and teaches `build-beta.py` to ship any
local module the page loads.

The mesher was chosen because it is the easiest subsystem in the file to prove
innocent. The whole algorithm body had **two** free names, `isSolid` and
`B_AIR`, both now arguments, and **one** call site, unchanged. No THREE, no DOM,
no `State`, no chunk reference. The comment above it has claimed since it was
written that it was built to move.

About 50 lines leave `index.html`. `greedyQuads` becomes a one-line adapter, so
the call site at the meshing loop does not change at all.

## Files

| File | Where it goes |
|---|---|
| `071-mesher.js` | `apps/fracture-city-game/mesher.js` |
| `071-mesher-extraction-index.patch` | `apps/fracture-city-game/index.html` (73 lines of diff) |
| `071-mesher-extraction-build.patch` | `_build/build-beta.py` (27 lines of diff) |

```
cd "Fracture City"
cp _patches/071-mesher.js apps/fracture-city-game/mesher.js
git apply _patches/071-mesher-extraction-index.patch
git apply _patches/071-mesher-extraction-build.patch
```

The index patch was generated against the exact `index.html` now on disk
(md5 `e29228fb4b6d4c587b066adabab39023`). If that has moved, tell me and I will
regenerate rather than have you resolve a conflict by hand.

## The dependency that makes this dangerous, and the test for it

`build-beta.py` wrote exactly one HTML file plus three.js into the deploy. A
sibling module 404s there and nowhere else: the same shape as the arcade bug in
section 64, which read as "none of the arcade games work" for weeks.

I ran the failure deliberately before fixing it. `npm run web` against the
patched tree with the build left alone:

```
missing from dist: mesher.js
local request failed: 404 /mesher.js
FAIL  every local <script src> is in the dist  got 1, want 0
FAIL  no local request failures in the deploy  got 2, want 0
```

The build half of the patch makes the build follow the page: it scans the built
HTML for local `<script src>` and copies each one, and exits with an error if a
script tag has no file behind it. Nobody has to remember a manifest field, and
the next extracted module ships for free.

## Evidence that behaviour did not change

Recorded before, on the current `index.html`:

```
digest 01ea090b1a410235 · 10,273 quads · area 12,274 == 12,274 boundary faces
```

After applying all three pieces to a scratch copy:

```
mesher-golden  digest matches golden  01ea090b1a410235     6 checks, 0 failed
boot           21 checks, 0 failed
webbuild       14 checks, 0 failed
```

The digest covers `greedyQuads`, `isSolid`, and the solid flags in `BLOCKS`, so
a deliberate change to any of those is supposed to move it. Re-record with
`npm run mesher:record`, in a commit of its own.

## Suggested commit order

1. `_test/` and `_patches/`, with `mesher.golden.json` recorded against the
   **unpatched** file. Nothing in `apps/` changes.
2. The extraction. `npm run mesher`, `npm run boot` and `npm run web` must all
   pass and the digest must not move. If it moves, the extraction changed
   behaviour: revert rather than re-record.

Nothing else belongs in either commit.
