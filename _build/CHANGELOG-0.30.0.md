# Fracture City 0.30.0 · Still Human // Wild, and the wrist

**This commit carries three releases.** `0.28` and `0.29` were finished in the
working tree and never committed: HEAD was still `0.27.0` when this was
written, and the tree was at `0.29.0` before the work below began. Section 66
(the cast), section 67 (the feel tick) and the `data:listFrom` IPC they need
are in here alongside `0.30.0`, because that is what was on disk.

Nothing is lost that was not already unrecorded. It is worth knowing that the
diff is bigger than one release.

## The wrist: T to speak to the street

Reported as *"it freezes when the chat bar opens"*. Nothing freezes.

```
shOpenCompose()  ->  document.exitPointerLock()
                 ->  pointerlockchange fires
                 ->  handler reads "lock lost, nothing open"
                 ->  #lock-instruction rises, full screen, z-index 70
```

The compose bar is z-index 60. So the bar opens **underneath** a transparent
click-to-relock sheet. The click meant to focus the input is eaten by the sheet
and relocks the pointer instead, which hides the bar without ever calling
`shCloseCompose()`. `Bubbles.composing` is then stuck at `true` and T is dead
for the rest of the session. Two faults stacked: the input is buried, and the
flag is orphaned.

Five fixes, smallest first:

* CSS suppresses the plate whenever `body.composing`. Declarative, so it cannot
  lose a race with the handler that raises it.
* The bar outranks the plate anyway.
* Held keys are released on open, so typing *sw* no longer walks you into the
  road while you are looking at the keyboard.
* A click on the world closes the bar properly rather than orphaning it.
* T is deaf while an arcade cabinet is up, so the bar cannot open over a game.

Verified: three open, type, release cycles in a row, with the input the topmost
element at its own centre every time, and three bubbles on the street.

## Still Human // Wild

A new app at `apps/still-human-wild/`, and the arcade's ninth cabinet.

One hundred and ninety metres of heightfield: plains, a wandering river cut,
snow-capped ridges pushed out to the rim. A Kiln at the centre that is not made
of blocks and therefore cannot be broken. Third person over the shoulder,
stop-motion at twelve frames a second, flat-shaded clay with per-triangle tint
drift and a generated thumbprint grain over everything.

Day is yours: gather, sculpt the ground, build in six materials. After dark the
ground gives up husks, stalkers, lumberers, emberwisps and molders, and **every
one of them leaves a weapon or a piece of plate on the grass**. Dawn burns
whatever is still standing. Saves are sparse and complete: seed, terrain edits,
every placed block, felled nodes, kiln levels, tools, kit.

### The arcade slot list was one entry from eating a cabinet

`shFitArcade` does `roster.slice(0, slots.length)`, and there were eight of
each. A ninth plinth along the east wall, plus a comment saying why, so the
next cabinet added does not silently drop the last one off the end.

### One engine, two hosts

The engine mounts into a box rather than owning a page.

* **In the shell** there is a real `apps/` tree, so the cabinet loads the app in
  its iframe exactly like every other cabinet, and the hub lists it on its own.
* **On the web** there is no `apps/` tree, so `build-beta.py` compiles the
  engine into the page and section 68 draws it straight into the cabinet stage,
  parking the city's renderer while it holds the screen.

One source file, both hosts.

#### A real bug found doing that

The builder's first attempt spliced its `<script>` at the **first** `</body>`,
which is inside the field book's HTML export template literal, not at the end of
the document. That closed the game's own script mid-expression and killed the
entire city with `Unexpected identifier 'rgba'`. It cuts at the last `</body>`
now, with a comment saying why.

## The gathering loop was invisible, not broken

First play report: *"the breaking or gathering of resources seems broken, cannot
figure out how to get more materials."* The mechanics worked from the first
build. Six things were wrong with everything around them:

1. **The swing was aimed by the puppet, not the camera.** The puppet turns to
   face movement the instant you touch a key, so the arc pointed wherever you
   last walked rather than where you were looking. Strafing past a tree and
   swinging missed, and nothing said why. It reads the camera now.
2. **Standing too close refused, silently.** Trees have no player collision, so
   you can stand inside one. At distance near zero the facing dot collapsed and
   `dot < 0.35` skipped it. The most natural approach was the one thing that
   could not work. Anything inside 1.1m is in the arc by definition now.
3. **No affordance anywhere.** No highlight, no prompt, no progress, no line on
   the title card. The player was expected to guess that the combat button was
   also the gathering button.
4. **Boulders spawned on slopes only**, so the nearest one to the Kiln was 26m
   up a hill and stone read as non-existent. They are through the flats now.
5. **Earth had no visible source.** It came only from lowering terrain in a mode
   nobody had opened, so two of the six build materials looked broken.
6. One swing could only ever hit one tree *or* one rock, never both.

### Hold to gather

Look at a tree, boulder or clay bank. A coloured ring lights on the ground, a
plate under the crosshair names it and says what it is worth, and holding the
button fills a radial ring until it comes up in one piece. Tap instead of hold
and it tells you the rule once, at the moment it did not work.

**Clay banks are new.** They cluster at the river cut and sit thinly through the
plains, so earth has somewhere to come from that you can see. Trees keep back
past 25m so the Kiln is never buried behind a treeline, which also gives the
opening shot a clear yard. From spawn: nearest tree 1.6m, clay 4.7m, boulder
12m, against 26m for the nearest anything before.

### The bench

Stand at it, press E. Three columns:

* **Tools.** An axe and a pick, three tiers each. The first axe takes the same
  tree from 2.3s for 6 timber to 0.95s for 9, so it is felt rather than read
  about.
* **Gear.** Push a worn piece up a rarity step for ember, which is what finally
  makes killing things worth doing after you have a weapon you like.
* **Scrap.** Spares melted down.

### The Kiln grows

Widen the ring 13m to 22m, feed the braziers to push the spawn exclusion out and
burn brighter, raise the tower for a faster mend inside the ring, better the
bench to unlock the top tiers.

Every upgrade changes the world rather than a number: the protection ring, the
eight braziers and their posts all move outward, and the tower actually scales.
The terrain plateau underneath is baked once at the widest radius the ring can
ever reach, so widening never means regenerating ground.

## Verified

Against the files on disk, on both hosts:

```
standalone app      mounts, own save namespace, Esc returns to title
city cabinet        loads the app in the shell, mounts in-page on the web
Esc                 leaves the cabinet and restores the iframe
other cabinets      still show the honest dark panel on the web
T bar               opens, focuses, releases, reopens, three times running
focus + hold        prompt, ring, yield, tool speed-up
bench               tools, gear, kiln, all three columns
kiln upgrades       ring mesh and braziers move, tower scales
save round trip     kiln levels, tools, felled clay banks
page errors         0 on every path
```
