# The Custody House

The first institutional building in the inhabited-city direction: a detailed jail with authored routines, readable consequences and a playable alternative to waiting. It does not call an LLM. The guard, worker and inmate are lightweight local characters; conversation lines and the escape sequence are authored.

## Location and architecture

West of the Mnemonic Archive and Resonance House, northwest of the Church of Omnism. The public entrance is on the east street at (67, 2, -34). The authored block occupies chunks 1–2 × -2–-1. Its 40 × 40 m floor plate sits at elevation 2, with 13 m perimeter walls, open courtyard roof ribs and two 24 m service lanterns. Limestone fins, a dark plinth, bronze reveals, amber cell lighting and blue service markings unify the building.

The building contains an east intake desk, property lockers, visitor phones and screen, two furnished cells, laundry machines and folded linens, exposed pipes/valves, a planted exercise courtyard, benches, a roster board, a guarded service wing and a rainwater outlet. The playable level has actual voxel walls/floors and furniture collision. Roofs and upper lanterns are decorative architecture rather than additional walkable storeys. Repeated details use material-based instancing; no added dynamic lights or shadow maps. Mesh resources and NPC bodies are disposed on scene change, and reattached after same-scene resets.

## Sentencing

Three distinct player-caused civilian deaths within a rolling 300,000 ms window trigger a 600,000 ms sentence. A death exactly five minutes after the first still falls in that window. Nonlethal injuries, protected story-character knockdowns, enemy creatures, hostile Casting Booth NPCs and PvP deaths do not count. A nonhostile civilian fighting back after being attacked remains a civilian.

The existing First Night lethal-damage branch reports street/shop deaths once. The Casting Booth combat path now permits lethal damage to nonhostile NPCs outside its existing safe zones; zero HP counts once and pays no bounty. Shared NPC deaths are attributed on the server through `spawns.cjs`. Hostile NPC rewards remain unchanged.

On the third death the player is moved to cell A-01. Equipment stays in inventory but attacks, special abilities, mining and placement are disabled. Server mutations such as world editing, god mode, NPC spawning and shooting are rejected while sentenced. Ordinary walking remains available. Movement outside the current confinement area returns the player to the cell/laundry anchor; death or respawn does not bypass custody. Jail is also an Ashbound sanctuary.

The ten minutes are elapsed wall-clock time, including menus and time offline. Online records are account-wide, stored in SQLite independently of room/visit saves and restored after server restart. Solo records use browser localStorage independently of individual save slots. A new world does not wipe an active solo sentence. Expired sentences release to the public street, including reconnects from a saved jail position.

## Escape (0.111: a stealth breakout you play)

No panel is required. Prompts appear beside the object; hold E (or press and hold the prompt on touch). The bar starts on the key press.

1. **The cell vent** (A-01, west wall). Hold 5 s to pry the cover. Brandt walks the cell corridor and stops to look into each cell; if he sees you prying, you are caught.
2. **The duct.** A real, walkable 1 m passage behind the cells under a steel lid, lit by small amber strips. At the far end, hold 2 s to push out the laundry grate.
3. **The uniform rack** (laundry). Hold 3 s. Before the uniform, any guard who sees you outside your cell fills the SEEN bar quickly, and so does the yard searchlight. In uniform, guards only notice you within about 3 m.
4. **The key cabinet** (control room). Hold 3 s, only while Officer Vale is out on his yard round (the second half of every 36 s cycle, server-checked). Being seen while lifting the key raises the bar.
5. **The rainwater outlet.** The key opens the service door. Hold 5 s at the outlet in the south wall of the service passage to escape.

Guards show their sight cones on the floor (yellow, red while noticing you). The SEEN bar at the top fills while you are noticed and drains when you are not. Full bar: alarm, back to A-01. An opened vent stays open; the uniform and key are lost (server stage drops to 1).

The plan panel (tap the CUSTODY box) lists the steps reached so far. It is optional.

## The building (0.111)

Grey concrete perimeter 9 m tall with razor wire and wall-mounted floodlights; Cell Block A with four barred cells (bunks, toilet, sink), a corridor with a locked gate to the yard; the service duct; the laundry (drums, press, uniform rack); an open-air yard with court lines, hoop, tables, a guard tower with a sweeping searchlight; the control room (desk, monitors, key cabinet); the service passage with pipes and the outlet; public intake (glass desk, lockers, phones) behind a concrete forecourt so street parking never blocks the door. Ceilings rest on the partition tops. Bars, bunks, desks, cabinets, the tower legs, the vent, the grate and the service door all collide. Inmates wear orange; guards wear navy with caps, badges and batons; the laundry worker wears grey. The weapon in your hand is hidden in custody.

Block ids 200–207 are reserved for the building.

## Authority and limits

Online sentence deadlines, shared-NPC death attribution, ordered escape steps, proximity/time checks and confinement are server-owned. The procedural street/shop population remains client-simulated in the existing game. Its death reports are authenticated, vicinity-checked, deduplicated and retried after connectivity failures; they are not cryptographic proof of a kill and a modified client can suppress them. Full anti-cheat authority for that population requires moving civilian simulation/combat to the server. Do not describe those ambient reports as fully server-verified combat. No other player's sentence can be submitted through this reporting endpoint.

Solo storage and the local clock can be modified by someone controlling their own browser. No penalties or moderation records are written outside the game. The prison does not implement real player bans or remove items.

## Tests

- `_test/justice.test.cjs`: rolling-window boundaries, duplicates, account isolation, restart, escape ordering/time, guard timing, release and shared-NPC attribution.
- `_test/justice-server.test.cjs`: authenticated HTTP flow, confinement, mutation locks, respawn/rejoin/restart persistence, cancelled holds, exact release deadline.
- `_test/jail-browser.test.cjs`: actual civilian deaths through the real weapon loop, admission/disarm, physical doors/floors, phone layout, saved sentence and all six timed escape steps.
- `_test/jail-online-browser.test.cjs`: online report queue, synchronized admission/position enforcement, physical timed action, reload and timed release.
- Existing server authority, city movement and NPC tests run as regression checks.

Only selected source/test/documentation files are installed. Player save files in `data/` are not modified. A GitHub push requires the normal hosted redeployment when automatic deployment is disabled.
