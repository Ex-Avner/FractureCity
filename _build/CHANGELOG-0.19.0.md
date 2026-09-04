# 0.19.0 — PACE, AND A CAST WITH FACES

## The opening was ninety-five seconds long

Measured, from clicking NEW GAME to being able to take a step:

| | |
|---|---|
| the opening film | 50.0s |
| the chapter card | 5.2s |
| a pause before the voice | 2.6s |
| Ned's first broadcast — 11 lines, 955 chars, modal | 37.0s |
| **total** | **94.8s** |

Ninety-five seconds, of which ninety were a frozen world and a card you clicked
through. And it did not stop after the opening: **three and three quarter
minutes** of the campaign's dialogue was delivered exactly that way, with the
simulation paused for every word.

**The mistake was a category error, not a length problem.** There are two kinds
of speech in this game and they were sharing one mechanism:

- **One-way.** Ned reading the news at you. A chapter opening. You cannot answer
  any of it. Freezing the world buys nothing — it only takes the game away while
  somebody talks.
- **A choice.** Two or three options, consequences, your name on the filing.
  This genuinely should stop everything, and still does.

So all one-way campaign speech is now **narration**: subtitles with a portrait,
auto-advancing, while you get out of bed and walk to the door. Ned talks you out
of the flat instead of talking at you until he has finished.

    94.8s  →  16.6s before you can move

The film is three shots and 12.6 seconds (it was six and fifty), the card is
3.0s, the beat before the voice is 1.0s — and the voice is live over the top of
you playing. Measured in the test: the player walks **9.75 metres** while Ned is
still mid-broadcast. The film also now says on screen that it can be skipped,
which it always could.

## Ned does not stop broadcasting

His whole character is that nobody told him to stop and he has decided not to
ask — and that was confined to cutscenes, because every line he had froze the
world to deliver. Now that one-way speech is free, he watches.

Get on the board, bail at forty, land something in the air, cross into the
Forge, take a beating, be out at four in the morning — he has a line, in the
same voice that reads the closures and the corrections. **Fifteen** things he
has an opinion about, each with a best line that fires **once, ever**, written
to the save.

> *Our correspondent has produced a skateboard with rockets on it. FCN has no
> category for this and will be filing it under weather.*

Three rules keep it from being noise: a 35-second global cooldown, much longer
per-event cooldowns (the first bail is funny, the fourth in a minute is not),
and he never speaks over a chapter beat, a conversation or a decision.

One bug worth naming: `NED.last` started at `0`, and `performance.now()` counts
from page load — so "never spoken" read as "spoke at time zero" and he was
silent for the first thirty-five seconds of every session, which is exactly the
stretch where you first get on a board.

## People who look like people

A resident was, in full: a box for a torso, a box per limb, a box for a head
with two dark squares on the front, a slab of hair, sometimes a hat. **Twenty-two
boxes.** At conversation distance that reads as a mannequin, and the game asks
you to stand two metres from one and listen to it talk.

Now **52–59 boxes**, and it costs no extra draw calls — a figure was always one
bake — for about twelve hundred more triangles a person.

- **A face.** Two dark squares is a domino, not a face. There is a brow, a nose,
  a mouth, eye whites with pupils inside them, ears, and a jaw narrower than the
  cranium — which is most of what stops a head reading as a cube.
- **Hands.** With a thumb, and a cuff above so the arm ends in something.
- **Clothes.** Collar, lapels, an open front with a shirt behind it, a belt with
  a buckle, pocket seams, hems, and shoes with soles — dress, boot or trainer.
- **A waist.** The torso was one box, so everybody was a fridge. Chest and waist
  are separate now and the archetype sets the taper.
- **Something carried.** Ten archetypes, **nine distinct** kit items: a bag
  strap across the chest, a medic's satchel, a scarf, a badge, a lanyard, an
  earpiece, a runner's wristband, an apron tie, studs. Plus glasses on some and
  stubble on others.

It is injected directly into `shBuildCharacter` one line above the bake, where
every measurement — torso height, shoulder line, arm length, the build and
height scales — is already a local. My first attempt wrapped the builder from
outside and tried to intercept its baker mid-build; that was fragile and I threw
it away.

## Verified

`pacetest.mjs` — 12 tests, green, covering all three of the above. Plus city 14,
barks 5, sky 12, board 20, flow 6, renderer 2.

One older assertion changed on purpose: barktest's *"a campaign beat still gets
the full card"* is now *"the three registers are distinct"* — a stranger barks,
the campaign narrates, and only a decision pauses.
