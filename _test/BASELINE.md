# Recorded baseline

Re-record deliberately, in a commit of its own. A baseline that moves as a side
effect of another change is not a baseline.

◆

## 2026-09-19 · game 0.33.0 · pre-extraction

Recorded in an Anthropic cloud sandbox: Linux, Chromium via Playwright, WebGL2
on SwiftShader (software rasteriser). `boot.js` forces ULTRA so the full surface
shader, the shadow map and the bloom chain all compile. **Seed `harness-seed`**;
a different seed is a different city and moves every count below.

### `npm run boot` — 21 checks, 0 failed

```
webgl2 context           webgl2
shader programs          34
scene pass               245 draw calls · 9,470 triangles   (45 chunks)
chunks                   5 at boot -> 45 after walking one chunk east
fittings placed          280 across 45 chunks
breakers placed          36
supply cut               131 blocks darkened
supply while cut         0 lit
supply restored          130 lit before == 130 lit after
local request failures   0
foreign requests         0
page errors              0
console errors           0
optional feeds offline   8 (not counted; no egress in this sandbox)
```

### `npm run mesher` — digest of the pre-extraction mesher

```
digest         01ea090b1a410235
quads          10,273
area total     12,274 == 12,274 counted boundary faces
               (a totals check: necessary, not proof of exact-once coverage)
deterministic  yes
```

Covers `greedyQuads`, `isSolid`, and the solid flags in `BLOCKS`. The extraction
in `_patches/071` was applied to a scratch copy and re-measured: **same digest,
same quad count**. That is the evidence the extraction is behaviour-preserving.

### `npm run selftest` — 4 checks, 0 failed

```
clean tree passes                     exit 0
harness rejects: supply does nothing  exit 1
harness rejects: newGame throws       exit 1
harness rejects: a local script 404s  exit 1
```

### `npm run web` — 14 checks, 0 failed, after the build patch

Run against a scratch copy with `_patches/071` applied. Before the build half of
that patch, this test failed exactly as intended:

```
missing from dist: mesher.js
local request failed: 404 /mesher.js
```

CSP served and exercised: `default-src 'self'`, `object-src 'none'`,
`frame-ancestors` present, `FC_STANDALONE` true.

### `npm run persist:browser` — 4 checks, 0 failed

Wrote through `window.fracture.save` in a persistent profile, closed the
browser, reopened, read the same value back, and confirmed a fresh profile does
not see it.

### `npm run persist:shell` — NOT RUN ANYWHERE

Attempted on the Mac, 2026-09-19: Electron exited with SIGABRT before a window
opened, and Chrome would not launch through Playwright either. Chromium's
download failed on repeated timeouts and TLS disconnects, so `boot.js`,
`webbuild.js` and `selftest.js` have not run locally at all. **Those launch
failures are environment failures and say nothing about the build.**

Two changes since, both aimed at that SIGABRT rather than at guessing:

- The isolated tree no longer symlinks the whole 502MB `node_modules`. `main.js`
  requires only `electron`, node builtins and its own `./services`, so exactly
  one package is linked. A symlinked `node_modules` was the first suspect.
- A preflight runs `electron --version`, then the app itself with a timeout,
  with `ELECTRON_ENABLE_LOGGING=1`, and prints what Electron actually said. A
  timeout on the second is the good outcome. This turns a signal name into a
  diagnosis.

### `npm run web` — version consistency, currently failing on purpose

```
PASS  SH_VERSION found                     0.32.0
FAIL  manifest version matches SH_VERSION  got "0.33.0", want "0.32.0"
PASS  zip is named for SH_VERSION          fracture-city-beta-v0.32.0.zip
```

`SH_VERSION` is authoritative: the builder, the zip name and section 62's
release gate all read it, while `fracture.app.json` is read only by the launcher
grid. `_patches/072` reconciles them. See that patch's README.

### Independently reproduced, 2026-09-19

The pure-function half of the mesher comparison was re-run by the creator
against both the inline `greedyQuads` and `_patches/071-mesher.js`, using the
real block definitions, outside this harness: same digest `01ea090b1a410235`,
same 10,273 quads, same 12,274 area and boundary-face totals, identical probe
output. Both patch files pass `git apply --check` against the current tree.

The creator also applied both 071 patches to a scratch copy: the full web build
succeeded including Still Human // Wild, `mesher.js` matched the supplied module
byte for byte, and both local script references resolved in the output. Live
`index.html` and `build-beta.py` are unchanged, all 120 data-file hashes still
match this snapshot, and no commits were made.

That reproduces the pure-function comparison and the build. Every browser-run
figure above is still one machine's word until Chromium launches locally and
`npm run boot`, `npm run web` and `npm run selftest` are re-run there.

◆

## Known divergence from real hardware

`data/fracture-city-game/hd.json` on the author's machine reads
`{"tier":"balanced","locked":false}` after the first session on 0.33.0: the
frame-time watchdog stepped the ULTRA default down there. The draw-call figure
above measures work submitted, not evidence that ULTRA holds at 60fps anywhere.
