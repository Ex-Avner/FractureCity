# The Custody House

The first institutional building in the inhabited-city direction: a detailed jail with authored routines, readable consequences and a playable alternative to waiting. It does not call an LLM. The guard, worker and inmate are lightweight local characters; conversation lines and the escape sequence are authored.

## Location and architecture

West of the Mnemonic Archive and Resonance House, northwest of the Church of Omnism. The public entrance is on the east street at (67, 2, -34). The authored block occupies chunks 1–2 × -2–-1. Its 40 × 40 m floor plate sits at elevation 2, with 13 m perimeter walls, open courtyard roof ribs and two 24 m service lanterns. Limestone fins, a dark plinth, bronze reveals, amber cell lighting and blue service markings unify the building.

The building contains an east intake desk, property lockers, visitor phones and screen, two furnished cells, laundry machines and folded linens, exposed pipes/valves, a planted exercise courtyard, benches, a roster board, a guarded service wing and a rainwater outlet. The playable level has actual voxel walls/floors and furniture collision. Roofs and upper lanterns are decorative architecture rather than additional walkable storeys. Repeated details use material-based instancing; no added dynamic lights or shadow maps. Mesh resources and NPC bodies are disposed on scene change, and reattached after same-scene resets.

## Sentencing

Three distinct player-caused civilian deaths within a rolling 300,000 ms window trigger a 600,000 ms sentence. A death exactly five minutes after the first still falls in that window. Nonlethal injuries, protected story-character knockdowns, enemy creatures, hostile Casting Booth NPCs and PvP deaths do not count. A nonhostile civilian fighting back after being attacked remains a civilian.

The existing First Night lethal-damage branch reports street/shop deaths once. The Casting Booth combat path now permits lethal damage to nonhostile NPCs outside its existing safe zones; zero HP counts once and pays no bounty. Shared NPC deaths are attributed on the server through `spawns.cjs`. Hostile NPC rewards remain unchanged.

On the third death the player is moved to Cell 01. Equipment stays in inventory but attacks, special abilities, mining and placement are disabled. Server mutations such as world editing, god mode, NPC spawning and shooting are rejected while sentenced. Ordinary walking remains available. Movement outside the current confinement area returns the player to the cell/laundry anchor; death or respawn does not bypass custody. Jail is also an Ashbound sanctuary.

The ten minutes are elapsed wall-clock time, including menus and time offline. Online records are account-wide, stored in SQLite independently of room/visit saves and restored after server restart. Solo records use browser localStorage independently of individual save slots. A new world does not wipe an active solo sentence. Expired sentences release to the public street, including reconnects from a saved jail position.

## Escape

The compact custody HUD opens a plan; E or the touch prompt operates the next physical lead. Each action requires proximity, ordering and a short timed hold:

1. Read the scratched bedframe (2 s).
2. Work a strip loose from the meal tray (4 s).
3. Open the west vent and crawl into laundry (8 s).
4. Study the service roster beside the courtyard (3 s).
5. Slip past the guard during the clear half of a 36 s patrol (3 s).
6. Crawl through the rainwater outlet (5 s).

The guard visibly walks west and back during the clear half. The passage gate rotates with that cue. Starting or completing the passage action while it is watched fails without resetting the whole escape. Moving out of range cancels an active server hold. Vent/outlet actions explicitly transition the player through narrow ducts; they are not free-form crawl physics. Escape clears the sentence and the kill window, restores equipment use and pays no reward. Serving the deadline has the same release outcome.

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
