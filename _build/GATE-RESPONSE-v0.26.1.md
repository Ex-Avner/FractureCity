# Response to the Release Readiness report — verified against the code

*Report reviewed: "Fracture City — Release Readiness and Living City Plan", written
against v0.23.0. This response is written against **0.26.1**, and every line of it
is backed by a test that runs in six seconds.*

---

## The seven findings, checked

| Report | Severity | Verdict at 0.26.1 |
|---|---|---|
| Town Square loader wiring | **BLOCKER** | **Wrong** — see below |
| Version truth | HIGH | Was true. **Fixed.** |
| Privacy / network truth | HIGH | Was true. **Fixed.** |
| News performance | HIGH | Was true. **Fixed** — 61 requests → 1 |
| Security headers (CSP) | MEDIUM | Was true. **Fixed**, and tested under the header |
| Single-file risk | MEDIUM | **Still true.** Agreed, and it is the next structural job |
| Outside-player test | MEDIUM | **Still true.** Zero external playtests |

### The BLOCKER is not a blocker

The report says the Square is broken because the new HN and Wikipedia fetcher is
assigned to `window.shSquareFetchBrowser` while `shLoadSquare` still calls the
lexical `shSquareFetchBrowser`, so the new channels fall through the Mastodon
path.

That reasoning is correct for a `const` and **wrong for a function declaration.**
A top-level `function f(){}` in a classic script becomes a property of the global
object, so identifier resolution goes through that object and assigning
`window.f` is exactly what the later call sees. `shSquareFetchBrowser` is a
declaration.

Proved two ways rather than argued: a spy placed on the window property is
reached by `shLoadSquare`, and the build test records `hn.algolia.com` and
`en.wikipedia.org` among the hosts actually requested — hosts that exist nowhere
but the new path.

One detail the report missed and would have been right to flag: **both Bluesky
channels are off by default** and live only in the picker. That is deliberate,
but it does mean `public.api.bsky.app` is never contacted on a default boot.

## What was fixed

**Version truth.** Was still broken at 0.26.0 — the pause menu was patched by
hand at some point and the class-select screen and front door were left saying
`v0.15`. Hand-patching one element per release is how a version string goes
stale in the first place. There is now one `BUILD_VERSION`, and every heading
that carries a version is rewritten from it at boot. The test walks those
headings and fails on any string that is not the build's own.

**The wire: 61 requests → 1.** `topstories.json` plus one `item/<id>.json` per
story, eight at a time. Algolia's index returns the same front page — title,
url, points, timestamp — in a single request. The firebase path is kept as the
fallback, because a second source reached only on failure is the difference
between a quiet degradation and a blank ticker.

> The report undersold the existing mitigation (a 45-minute cache means a page
> reload never cost 61 requests) and oversold the danger. It was still 61 round
> trips on every cold start, on a phone, on the frame budget of a voxel city.

**Network truth.** The README claimed "no CDN, no network" while the renderer
carried a `document.write` fallback to cdnjs, and the Town Square was described
as the only internet feature while Ned's ticker was fetching Hacker News. Both
now come from **one list** — `NETWORK_HOSTS` in the game, `FEED_HOSTS` in the
build script — and a test fails if the two disagree. The hosted build has the
CDN fallback **removed outright**; the desktop shell keeps it, because it once
rescued a build whose vendored path did not exist and the failure it prevents
(a menu that draws perfectly and does nothing) is the worst one there is.

**CSP.** Twelve directives, generated from what the build actually contacts, and
extended automatically when the build is made with an analytics key. The test
that matters is not that a header exists — it is that the game **boots and runs
under it**, which is the only way to learn that a policy is wrong before a
player does.

`'unsafe-inline'` is in there and is not going away this release: the game is one
enormous inline `<script>` with inline `<style>` injected by two dozen sections.
Hashing every one of them is a real job for after the source split, not
something to fake with a permissive policy that reads as strict.

## Where the report is most right

**"The one-file build is an output format, not a development architecture."**
Yes. 27,028 lines in a single file is why this game is patched by splicing twelve
numbered sections at a fixed anchor and re-applying all of them from a pristine
base — that is not a technique, it is a workaround for having no modules. It is
also why a `requestAnimationFrame` fork bomb three lines into the render loop
survived four separate passes at "the intro is laggy".

Two of the report's prerequisites for that work are now done, both today: the
project is **under version control** (308 files, 196,341 lines, first commit
clean) and there is **error telemetry with session replay** — a nine-suite,
106-check harness plus real reports from real machines. The split is now safe to
attempt, because everything would say so immediately if it broke.

**"Build observability before autonomy."** Strongly agreed, and this is the line
I would put above the whole 90-day plan. Nothing in Phase 1–3 should start until
there is a day where the question *"what did the city say, why, and how do I
undo it"* has an answer on a screen.

## Where I would change the plan

**Phase 0 is nearly finished, and the remaining item is the one that has never
been attempted.** Of its five bullets, four are done. The fifth — *"finish the
first twenty minutes of Chapter One with sound and five outside playtests"* — is
the only one that requires a person who is not the author, and it is worth more
than the four that are done. No amount of instrumentation substitutes for
watching somebody who has never seen this city try to leave their apartment.

**Reorder Phase 1.** The report puts Auth, profiles and photo storage first.
I would put the **source split** first, alone, before any backend work — for
exactly the reason the report gives in Developer Note 2: new social code landing
on a 27,000-line file will create another layer of late overrides, and the late
overrides are where every bug in this project has lived.

**On the photo pipeline:** the report's acceptance rules are sound and I would
add one. *Do not ship the photo upload in the same release as the profile.* A
resident record with a character maker is shippable and needs no moderation
queue, no EXIF stripping, no signed URLs and no abuse policy. A face upload
needs all five before the first stranger arrives. They are separable, and
separating them buys weeks.

**On the curator agent:** agreed on every constraint — content agent not code
agent, draft-only for thirty days, immutable log, rollback. The one thing I would
add to the tool permission list under *Never allow*: **the agent may not read
telemetry**. It is now possible for the city to know how players behave, and an
editor that optimises its edition against engagement is the exact thing the
"civic weather" design is written to prevent.

## Where the project actually stands

Against the report's own release standard — *a stranger should be able to enter
on phone or desktop, create or resume a resident, understand what data leaves
the device, encounter a working first civic signal, complete Chapter One, and
leave with a reason to return tomorrow* — five of those six are true today.

The sixth is **the stranger.** There has never been one.

## Suites

`betaA` 12 · `betaB` 7 · `flowtest2` 13 · `fittest` 13 · `depottest` 10 ·
`squaretest` 10 · `touchtest` 13 · `betabuildtest` 10 · `teltest` 11 ·
`gatetest` **7** — **106 checks, all passing.**
