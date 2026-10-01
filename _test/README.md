# _test — the verification harness

Tests for the Present Palm ecosystem. Every script asserts; the exit code is a
function of the checks and of nothing else. `selftest.js` breaks the build three
ways and requires the harness to reject all three, because a harness that has
only ever seen a working build is an opinion.

◆

## Install

```
cd _test
npm install
npx playwright install chromium
```

## The tests

| Command | What it proves | Verified |
|---|---|---|
| `npm run boot` | the source tree boots, renders, streams, and the supply round-trips | yes |
| `npm run selftest` | the harness fails on a broken supply, a throwing `newGame`, and a 404 on a local script | yes |
| `npm run mesher` | the mesher's output digest, determinism, and an area-totals check | yes |
| `npm run mesher:record` | re-record that digest, deliberately, in its own commit | yes |
| `npm run web` | the built deploy: `build-beta.py`, every local script present, real CSP headers, `FC_STANDALONE` | yes |
| `npm run persist:browser` | localStorage survives a real browser restart, with a persistent profile | yes |
| `npm run persist:shell` | the Electron save bridge writes to an isolated data dir and survives a restart | **no, see below** |
| `npm run compare` | four A/B screenshots of the render pass | yes |

`persist-shell.js` has never been run to completion. Electron needs a display
and a platform-matched binary and the machine that wrote the test had neither.
It refuses to run if the data directory it resolves is the live one. Run it once
on the Mac and record the result in `BASELINE.md` before treating a pass as
evidence.

## Two kinds of persistence, two tests

They are different code paths and one does not imply the other.

- **In a browser** every app falls back to a localStorage shim defined at the
  top of its own file. `persist-browser.js` tests it with a persistent browser
  profile in a temp directory. Copying `data/` proves nothing here, because a
  browser never reads `data/`.
- **In the shell** writes go over IPC to `data/<slug>/<key>.json`.
  `shell/main.js` resolves `ROOT = path.resolve(__dirname, '..')` and
  `DATA_DIR = ROOT/data` when unpackaged, so the only way to isolate it is to
  run a copy of the tree whose `data/` is elsewhere. `persist-shell.js` does
  that and asserts the live folder was not written to.

Neither test touches the creator's saves.

## How failures are classified

The first version of this harness filtered every console line containing
"Failed to load resource", which is the same message Chromium prints for a 404
on a local script. It was hiding the one failure it most needed to catch.

Requests are now classified by URL against the origin being served:

- **local**: any status ≥ 400, or a transport failure, is a test failure.
- **optional**: the five feed hosts the game contacts on purpose
  (`mastodon.social`, `hn.algolia.com`, `hacker-news.firebaseio.com`,
  `public.api.bsky.app`, `en.wikipedia.org`). Unreachable is recorded and
  forgiven, because a sandbox with no egress is not a broken build.
- **foreign**: anything else is a test failure. The game is not supposed to
  contact hosts that are not on that list, and the CSP says so too.

Console errors are matched to a URL through the message's `location()`, because
Chromium's resource-error text carries no URL at all.

## What the mesher area check is, exactly

`mesher-golden.js` compares summed quad area against a directly counted number
of solid/air boundary faces. That is a necessary condition and nothing more: an
overlap and an omission of equal area would cancel and the check would still
pass. It is cheap and it would catch a gross miscount, but the evidence that the
mesher's output did not change is the digest, not this.

## What these tests do NOT establish

- Not that the game is fun, finishable, or correct. They prove it boots,
  renders, streams, and that named systems round-trip.
- Not anything about frame rate. `boot.js` runs under SwiftShader, a software
  rasteriser. Draw calls and triangle counts are meaningful; milliseconds are
  not.
- Not that all cities work. Generation is seeded; a pass is a statement about
  the seeds named in `BASELINE.md`.
- `boot.js` tests the source tree and `webbuild.js` tests the deploy. Neither
  substitutes for the other, which is the lesson section 64 of the game file
  already paid for.
