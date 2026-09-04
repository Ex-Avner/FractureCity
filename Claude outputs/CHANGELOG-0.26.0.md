# Fracture City 0.26.0 — instrumentation, and a repository

Not a gameplay release. This is the release that changes how faults get found.

## The problem it is solving

Every bug fixed in this project so far has arrived the same way: the game is
played, something is wrong, a sentence is typed about it, and I build a headless
probe to reproduce it. That has worked — the `tick()` fork bomb was found that
way — but the loop is hours long and it only ever runs on one machine.

Four of those sentences, and what would have answered each in a minute:

| what was said | what would have answered it |
|---|---|
| "the intro is still laggy" | `frame_health` — worst frame, not the median |
| "the intro froze almost immediately" | `intro` — line 0 after 40 seconds |
| "mobile freezes on any pop-up" | `tap_target` — every tap landing on `#touch-layer` |
| "the zombie mode is too weak" | `session_end` — how long anyone stayed |

## Section 61 · telemetry

PostHog, with session replay, error tracking, and **eight** events. The count is
deliberate: every event added is one more thing to read and one more thing to
get wrong.

- **`intro`** — seconds, line reached, lines total, finished or skipped, seconds
  per line. A stall now arrives as *"line 2 after 40 seconds"* rather than *"it
  froze"*.
- **`tap_target`** — the id of the topmost element at the point of contact,
  sampled to 40 a session. The mobile freeze was an invisible full-screen sheet
  at a tying z-index; nothing about it was visible from the outside and the
  hand-maintained "is a panel up" list could not see it either. This one field
  would have named it on day one.
- **`rage_tap`** — three contacts inside 600ms within forty pixels. What "it
  froze" looks like from inside the page, arriving with the name of the element
  that swallowed them.
- **`frame_health`** — once a minute: median, p95, **worst**, the count of
  frames over 100ms and over 500ms, chunks loaded, queue depth, and
  `Stream.peakMs`. A median alone showed nothing wrong while single frames were
  taking 7,425ms, so both numbers or the report is useless.
- `boot` (version, screen, cores, **GPU name** — "slow" and "slow on a software
  rasteriser" are different bugs), `game_start`, `chapter`, `shift_start` /
  `shift_end`, `death`, `siege_start`, `session_end`, `js_error`,
  `promise_rejection`.

### Off by default, and off means off

The desktop shell and the canonical app carry **no key**, so they create no
script tag and make no off-origin request — verified by two tests, one in the
telemetry suite and one in the build suite. The beta build gets a key injected
at build time by `_build/build-beta.py --key phc_…`; without the flag it ships
silent, which is the state the zip is in right now.

Three ways to be off, one of which is the browser's own setting:

```
navigator.doNotTrack === '1'          → nothing loads, nothing to switch off
localStorage 'fc-telemetry' = 'off'   → set by fcTelemetry(false)
no key configured                     → the default
```

Typed input is masked in replays. The only text a player enters in this game is
a display name. It is documented in the beta README so testers can read it
rather than discover it.

## `_build/build-beta.py`

The beta build was three manual string edits and a `zip` invocation carried in
my head between sessions. It is now a script in the repository that does exactly
three things: flatten the vendored three.js path, inject the analytics config,
and write `_headers` / `_redirects`. Run it with no arguments and you get the
silent build; run it with `--key` and you get the reporting one.

## The repository

The whole project — ten apps, the shell, the data, every changelog and every
beta zip back to v0.11 — was in exactly one place, on one disk, with no history.
It is now a git repository: **308 files, 196,341 lines, 12MB packed.**
`node_modules` is ignored; the old zips are not, because for versions whose
source no longer exists they are the only record there is.

## Suites

`betaA` 12 · `betaB` 7 · `flowtest2` 13 · `fittest` 13 · `depottest` 10 ·
`squaretest` 10 · `touchtest` 13 · `betabuildtest` **10** · `teltest` **11** —
**99 checks, all passing.**
