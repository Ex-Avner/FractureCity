# 0.20.0 — THE STREET

You were right, and the number is worse than "cramped".

## The pavement was one metre wide

    chunk                24 m
    raised pad           16 m   (from 4 to 20)
    building on it       14 m   (from 5 to 19)
    ─────────────────────────
    PAVEMENT each side    1 m
    ROAD between blocks   8 m

One metre. And then, over the last few releases, I put this on it:

| | |
|---|---|
| market awning reaching out | 2.9 m |
| awning post | 2.6 m |
| market stall table | 2.4 m |
| Flood Gate duckboard | 2.0 m |
| sandbag wall | 1.6 m |
| street kicker | 4.6 m across an 8 m road |
| skatepark quarterpipe | **11 m across a 14 m park** |

Every one of those was standing in the carriageway or inside a wall. That is
the whole of "crammed and narrow and mishapily placed" — not a placement bug
scattered across eleven passes, one measurement nobody had taken.

## What changed

**The block and the street trade places.** `CHUNK_SIZE` stays 24, because the
world grid, every landmark, every interaction hotspot, the campaign's
coordinates and the minimap are all defined against it. So instead:

    was  16 + 8  = 24
    now  14 + 10 = 24

**And the buildings are set back from the kerb**, which is the thing that
actually creates a pavement — a new `BUILD_INSET` of 2.4m (1.5m where a block
is subdivided, so terraces do not become sheds).

    PAVEMENT   1 m  →  5.5 m measured
    ROAD       8 m  →  10 m

**Every prop now measures against the pavement instead of picking a number.**
`PAVE_W` and `BLOCK_HALF` are named once and everything mounted on a frontage
reads them: awnings reach `PAVE_W - 0.5`, stalls stand against the shopfront,
duckboards sit on the kerb line rather than 1.6m out over the water, Forge
drums and Flood bollards are scattered along the *pavement band* instead of
across a 20m square that was mostly road and mostly building, and the Forge's
chain fence is on the kerb rather than a metre into traffic.

**Ramps are sized to the ground they stand on.** The skatepark's transitions
are now `min(4.2, reach × 0.55)` half-width rather than a flat 5.5 — two 11m
quarterpipes never fitted in a 14m park. Street kickers went from 4.6m to 3.2m
so a 10m road still has a lane past them. Measured: 109 ramps, widest 6m, all
fit.

**The trees were growing through each other.** 9–16 of them with 5–7 block
canopies thrown at a 14m park with *no spacing check whatsoever* — about 300
blocks of leaf competing for 196 blocks of ground. They grew through each
other, through the fence and through the bandstand. Now each has to clear the
ones already standing, and the count is a ceiling rather than a promise: a park
that only fits five gets five. Measured: 0 overlapping canopies.

**Kerb rails run nearer the corners** — the narrower pad had shortened them to
10m, which is short enough that you are off before the grind has told you
anything. Back to 12m.

## The measurement I got wrong first

My own audit reported "Residential 38.6% of props over the kerb" and I nearly
went and moved balconies that were fine. The metric used `max(w, d)` as the
extent on *both* axes, so every long thin part — every wire, every rail, every
awning — measured as if it were square and flagged itself.

With the extent resolved per axis against each part's yaw, the real figures are
Market 0%, Flood 0%, Forge 2%, Residential 7.1%, and the two worst offenders
left are a stoop step 0.6m onto a 2.4m pavement and a Forge pipe at 0.5m. Both
correct.

Flood Gate's water is excluded, because it is a single 24m sheet laid over the
whole chunk *including the road* — the street is meant to be under it.

## Verified

`streettest.mjs` — 7 tests, green, every one a measurement rather than a look:
pavement and road width walked metre by metre, every district's props checked
against its own kerb line, every tree's nearest neighbour, every ramp against
the ground under it, every rail sorted into kerb rails (must be on the pad) and
door handrails (bolted to a building by definition).

Plus board 20, city 14, pace 12, sky 12, flow 6, barks 5, renderer 2 — all
re-run green after a change that moved every building in the game.
