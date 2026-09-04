# The Light Bearer — why it was unplayable, and what was actually wrong

You were right, and my tests were wrong. Clicking was never broken. There was
just nothing for a click to do.

---

## The bug

**The alcove hit zone sat 148 pixels below the alcove.**

```js
Math.hypot(a.x - mx, a.y - my + 74) < 96     // shipped
Math.hypot(a.x - mx, (a.y - 74) - my) < 96   // correct
```

An alcove is drawn from `a.y - 150` to `a.y`, so its middle is `a.y - 74`. The
sign was flipped, which put the target centre at `a.y + 74` — below the bottom
edge of the rectangle, out on the empty floor. **Clicking the alcove missed
every time. Clicking the floor beneath it worked.**

## Why that stopped the game dead

On its own that would have been a annoyance. What made it fatal is that
**THE ROOM offered no button at all until all four alcoves were lit.** So:

1. You click the title. The game starts.
2. You click an alcove. Nothing happens — you missed by 148px.
3. There is no button anywhere on screen.
4. You click more. Still nothing.

"The clicking does nothing, you get stuck on page one" is an exactly accurate
description of that. THE FALL had the same shape — no button for its first five
seconds.

## Why my tests passed anyway

Every one of them called `choice.act()` directly or set `State` by hand. **Not
one of them used a mouse.** A hit-zone offset is invisible to a test that never
clicks anything, and I had eighteen green tests sitting on top of a game nobody
could play.

---

## Fixed

- **The hit zone matches the drawing.** Clicking an alcove lights it.
- **No scene can be a dead end.** `optionsFor()` now guarantees at least one
  action in every state, and there is a test that sweeps all eight scenes
  through thirteen states each looking for an empty one.
- **THE ROOM can always be left** — "LEAVE THE ROOM" is there from the first
  frame, whether you light anything or not.
- **THE FALL offers both actions immediately** rather than after five seconds.
- **Unlit alcoves pulse, are outlined in dashes and are labelled DARK**, and the
  instruction says *"Click a dark alcove to carry light into it."* A dark
  rectangle is not an affordance.
- **The click listener moved from the canvas to the document**, so no layout
  problem can ever orphan it, and the canvas can no longer be scaled to zero by
  a parent that reports no size.

## And one thing in the city

The arcade cabinet decided whether an app had loaded with a blind 2.2-second
timer. On a slow machine that fires before a good game has finished loading, and
covers it with a panel saying it could not be found — which looks exactly like
the game being broken. It now listens for the frame's own load event, keeps a
longer deadline as a backstop, and takes the panel away again if the app turns
up late.

---

## Now verified by actually playing it

A new suite drives the game with **real mouse clicks at real screen
coordinates**, reading each screen and pressing what is on it:

```
 1. click the title                → room     panes 9
 2. click the four dark alcoves    → room     panes 9   [GO ON]
 3. go on                          → doors    panes 9
 ...
26. build a tier                   → kingdom  panes 0   [TURN AWAY | ASK THE QUESTION]
27. turn away                      → coda     panes 0
28. close the book                 → END      panes 0
```

Twenty-eight steps, no state poking, ends correctly at nothing passing through.

| suite | result |
|---|---|
| The Light Bearer | 20 / 20 |
| click-only playthrough | 28 steps, clean |
| the cabinet in the arcade | 3 / 3 |
| web beta · siege · story · front door · sound | 72 / 72 |
