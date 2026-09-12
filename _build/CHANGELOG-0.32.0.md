# 0.32.0 — ghosts, werewolves, and ten things with names

◆

## STILL HUMAN // WILD 0.4.0

### Two more kinds out there after dark

**Wraiths.** Drawn half there — the body is transparent, so moonlight, the
brazier ring and whatever is behind them comes through. No legs; a long shroud
where the legs should be, and a pair of cold blue lamps in a pale skull. They
throw no shadow, which is the one thing in the game the sun has no opinion
about. They float, they drift in fast, and they burn at dawn like everything
else.

**Werewolves.** The same armature pulled out into a beast: a long muzzle with
fangs top and bottom, upright ears with the left one torn short, a ruff of fur
sitting the head low between the shoulders, a tail curling up behind, and a
body pitched almost horizontal over enormous arms. They are the fastest thing
in the game. They close before you have finished deciding what to do.

Both were added to the night roster rather than bolted on: wraiths from the
third night, werewolves from the fifth.

### The Ten

The night wave was endless and therefore weightless — however well a night
went, the next one was the same night. There is now a spine of ten named
bosses running through the whole game. One walks in per night, starting on the
second, a third of the way into the dark, and **only once the one before it is
dead** — so falling behind slows the story down instead of stacking two of
them on you.

| | | |
|---|---|---|
| 1 | **The Marrow Warden** | opens every few seconds and pours husks out of itself |
| 2 | **Gravelash** | lunges, closing the gap faster than you can back out of it |
| 3 | **The Lumber Priest** | a ward that shuts for three seconds at a time and eats 84% of the damage; it tells you which by glowing |
| 4 | **The Emberchoir** | does not come to you. Fires in volleys from where it is |
| 5 | **The Hollow Bell** | a wraith the size of a house that is not always where you last put your eyes |
| 6 | **Moonjaw** | howls, and wolves answer |
| 7 | **The Molder King** | a ground slam that throws you clear, then closes the space it just made |
| 8 | **The Ashen Choirmaster** | makes emberwisps faster than you can kill them |
| 9 | **The Pale Twins** | two bodies, one life between them; hurting either hurts both |
| 10 | **The Unmaker** | slam, summon, blink, volley, in rotation — the last fight is a recap of the nine |

Each is the *same armature and the same code path* as an ordinary corpse with
its own numbers laid over the top, which is deliberate: a boss built out of a
separate system is a boss that breaks every time the shared one changes.

A bar across the top of the screen while one is up, with its name and its
number out of ten. The Twins share one bar, because they share one life. The
Priest's bar goes cold blue while its ward is shut.

Bosses do not burn at dawn. A boss you can out-wait is not a boss. They are
also not stun-locked by chip damage, which is what made the old big ones
trivial to back into a corner and hold there.

### Winning

Put the tenth down and the Kiln finishes lighting. There is an ending card,
and then the world stays: the nights keep coming, what walks in them is
ordinary now, and the country you spent all that time changing is still yours
to build in. The Work panel lists the ten — what is down, what is next, and
nothing at all about the ones you have not met.

Progress is saved with everything else, and a save written before the ten
existed loads as "none down" rather than refusing to load.

◆

## Also in this release

Carried over from the graphics pass: corpse-toned monsters with real anatomy
and faces, layered trees, moss on the boulders, ground cover that follows the
player, and a player puppet with a face and a belt.

Verified end to end: all ten called, fought and killed in order; the ending
fires on the tenth; the world survives dismissing it; progress survives a
reload; a new world forgets the ten. World, save, quest, launch in both hosts,
prop continuity, GPU leak and shadows all still pass. 456 draw calls with
sixteen monsters on screen.
