# 0.16.0 — THE BOARD

Shift+S, and the city stops being a grid of destinations.

Walking is untouched. This is a mode, bound the same way the siege is, and
everything you already do — combat, interaction, building, the campaign —
works exactly as it did the moment you step off.

## The four pieces

**Momentum.** Walking sets velocity from the keys and zeroes it when you let
go. That is correct for walking and fatal for a board. Here `W` is a push, not
a direction: it adds speed and you keep it. Steering is the mouse, and the
board's grip decides how much of your velocity the turn takes with it — tight
at walking pace, loose and drifty at forty. Measured: pushed to 16.5 m/s, still
doing 15.9 a full second after letting go of everything.

**The rockets.** Held `SHIFT`. Not a sprint button — 148 km/h against the 59
you can push to, out of a tank that two seconds of throttle takes from full to
40%, and that the idle trickle will not meaningfully refill. Grinding and
landing tricks are what fill it. So the fast way across town is the stylish way
across town, which is the only honest reason to put a trick system in a game
about a collapsing city.

**Rails.** Every city block here is a raised pad stamped one metre proud of the
road — four straight metre-high edges, sixteen metres long, on every block,
everywhere. The best rails in the city were a side effect of the pavement and
had nothing on them. Now they do, along with handrails down the doorway steps
and ledges through the skateparks. Roughly 100 rails across a loaded city.

**Ramps.** Solved as surfaces, not as voxels — a quarterpipe built out of blocks
is a staircase however finely you cut it, and you feel every step through the
board. Speed is conserved across the transition, so how high you go is decided
entirely by how fast you came in. Measured on a 6.2m quarterpipe: in at 8 m/s
gets you 2 metres up. In at 34 gets you **16**.

## Where they are

A share of the city's parks are now skateparks — two big transitions facing
each other down the long axis, a funbox with a rail over it, a flat rail off to
one side, two corner kickers, and floodlights, because the city's parks are
unlit and this is the one place you want to be at three in the morning. Streets
occasionally have a scavenged kicker left in them, hazard-striped.

## Controls

| | |
|---|---|
| `SHIFT`+`S` | board out / step off (you have to be slow to step off) |
| `W` | push |
| `A` `D` | carve — and a tap in the air is a flip |
| mouse | steer |
| `SHIFT` | rockets |
| `SPACE` | ollie — hold to load it |
| `S` | brake |

Spins are measured off the mouse, so a full turn is a 360. Land within about
thirty degrees of the way you are travelling and it counts; land sideways off a
trick and you go down. Chains bank into style and into credits.

## Two bugs worth naming

**The skatepark was poured on top of the park.** Trees were left standing in the
quarterpipes, which is why the first launch measurement came back at 2 metres
whatever speed went in — the run-up was hitting a trunk. Skateparks are now
decided before the park grows and are built instead of one.

**The dry tank sputtered.** The idle refill crossed the "any fuel at all" line
about six frames after the tank emptied, so holding the throttle on empty gave
you a permanent stuttering boost — seven metres a second out of nothing. Empty
now stays empty until there is 18% in it.

## Verification

`skatetest.mjs` — 20 tests, all green. Every one steps the real physics at a
fixed timestep; none of them trusts wall-clock time, and the RNG guard counts
draws from the shared chunk stream directly rather than trusting a comment about
it. The existing suites (flow 6, bubbles 18, beta 13, feel 16) are unchanged and
still pass.
