# THE LIGHT BEARER

Chapter one of *The Collapse of Meaning*, made playable. A new app at
`apps/light-bearer/`, and a cabinet in Fracture City's arcade.

---

## The chapter gave me the mechanic

One line does it:

> "He was a window, not a sun. And in his certainty that he was the sun, he had
> bricked himself closed."

So that is the game. You carry light and **the light is not yours** — it comes
from a source behind you, which you never turn around to look at, and it passes
through. You have nine panes. Every act of certainty bricks one, and a bricked
pane never opens again.

Two numbers are on screen and only one of them matters:

| | |
|---|---|
| **RADIANCE** | how bright you appear. Rises every time you assert yourself. It is the number that feels like a score. |
| **TRANSMISSION** | how much light actually passes through you. Falls as the panes close. |

Players chase the number that goes up. That is not a flaw in the design, it is
the chapter's argument, and the coda names it out loud.

---

## Eight scenes

1. **THE ROOM** — carry light into the dark alcoves. It is effortless and it
   costs you nothing, which is the point: this was never the hard part.
2. **THE CLOSED DOORS** — three doors, three questions, three deflections. Then:
   name the silence concealment, or let it be a thing you do not know.
3. **A GARDEN, IN FRAGMENTS** — you aim your light at it and it falls short. The
   garden has a light of its own.
4. **THE HIGH PLACES** — five others. Every one you win turns gold and raises
   your radiance, and every one costs a pane. You can stop at any point.
5. **THE PRESENCE** — the chapter's real dialogue, and the fork.
6. **THE FALL** — released, not pushed. One action: look back. You see the
   window from the outside for the first time.
7. **THE KINGDOM** — build five tiers, put yourself on top, rule it alone. The
   garden is still lit, far off, and still not yours.
8. **CODA** — the headstone.

---

## The one door out

The question the chapter says he never asked — *What if I am wrong?* — is
offered exactly once, at the Presence.

**It is only reachable while transmission is above a third.** That is not a
difficulty setting. It is the chapter:

> "The understanding required a door he had closed, a window he had bricked, a
> question he would not ask."

Play it the way it is written — name the silence, dismiss the design, take all
five followers — and by the time you reach the Presence the question is not on
the table. The only thing left to say is *I cannot*. Refuse, and the refusal
takes another pane; seal the kingdom, and it takes the last one. You finish at
0% transmission: "the capacity had gone dark. The receptors had fused shut."

Ask it in the kingdom instead of turning away and you get a third ending: the
door is locked from the inside. It is not a rescue.

---

## About the prose

**Every word of the chapter in the game is yours, verbatim.** The paragraph
array is *generated* from `apps/works/data/book.json` — the copy the Works app
already serves — rather than retyped, so it cannot drift. There is a test that
compares all 88 paragraphs byte-for-byte against that file and fails if one
character differs.

The game speaks only in stage directions, choice labels and the counterfactual
ending. That ending carries a line across the top of the screen the whole time
it is on:

> THIS IS NOT WHAT HAPPENED · THE DOOR HE DID NOT TAKE

and it ends by saying so in plain words. It does not give him a victory, and it
does not explain anything to him — he asks, receives nothing, and stays open
anyway. Adding a triumph would have been writing your book for you.

---

## Built the way the rest of the hub is

- **One file, no dependencies.** Canvas 2D. Measured: one network request, zero
  off-origin — no three.js, no fonts, no CDN.
- **Synthesised sound**, same as the city: a detuned drone, a chime when light
  lands, a dull thud when a pane bricks, a door settling into its frame.
- **Saves through the hub** as `lightbearer.run.v1` — which ending, whether you
  asked, panes left, radiance against transmission, how many followed.
- Works in the shell and standalone, via the same localStorage bridge every
  other app uses.

---

## Verified

| suite | result |
|---|---|
| The Light Bearer | 15 / 15 |
| the cabinet in the arcade | 3 / 3 |
| web beta, served as a static site | 13 / 13 |
| siege · bubbles · story · front door · square · sound · bestiary | 103 / 103 |

The first three tests are about your words, not my code: all 88 paragraphs
identical to `book.json`, every prose reference an index into the chapter rather
than a string, and nothing from the counterfactual ending appearing anywhere the
book's voice is used.
