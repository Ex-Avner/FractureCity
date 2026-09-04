# 0.18.1 — BARKS

Pressing E on somebody in the street opened the full dialogue card: a fixed
overlay across the whole screen, pointer lock released, cursor back, the
simulation paused, and *click anywhere to aim* waiting for you when it closed.
For one sentence from a stranger. Three interactions to receive one line, and
the world stopped for all three.

There are two registers now.

**The card** — campaign dialogue, decisions, anything the game genuinely wants
you to stop for. Unchanged.

**The bark** — one person, one line, bottom left. It types out, holds long
enough to read, and fades. Pointer lock is never touched, the sim never pauses,
and you can keep walking, keep aiming and keep skating while somebody talks at
you, which is what actually happens in a city.

The routing is not a list of call sites. `shTalkTo` already tags its speaker as
`inline` — an anonymous person from the crowd generator rather than one of the
named cast — so a single inline line goes to the bark and everything else goes
to the card. Nothing else had to change, and anything added later that speaks as
a stranger gets it for free.

## Verified

`barktest.mjs` — 5 tests, green, driving the real path (stand in front of a
passer-by, `findNearbyInteractable`, `handleInteract`):

- E on a stranger puts a bark up, leaves the card down, leaves `inDialogue`
  false and never adds the `in-dialogue` body class
- the player walks 4.66m and turns the view while the line is on screen
- the line types out, holds and clears itself
- a named, multi-line exchange still stops the game, as it should

`citytest.mjs` 14 also re-run green, which is the suite that covers campaign
dialogue and would have caught a regression in the card path.
