# Sun Fall — Extensions Roadmap

v0.1.0 ships a playable 20-minute loop. This doc plans the *large* extensions
that turn it into a real horror title without rewriting the foundation.

The v1 architecture in `index.html` is class-based so each system below has a
clear hook point — extension work is mostly **add a class** or **register a new
zone**, not refactor the engine.

---

## v1 inventory (what already works)

| System         | Class       | Hook for extension                                       |
|----------------|-------------|----------------------------------------------------------|
| World gen      | `World`     | `addRoom`, `addPickup`, `addRobot`, `addBulkhead`        |
| Per-zone décor | `Game._add*Decor()` | One method per biome — copy/paste for new biomes |
| Enemy AI       | `Robot`     | `kind` switch in constructor + `update()` state machine   |
| Player         | `Player`    | `keys[]`, `ammo`, `reserve`, `flashlightOn`               |
| HUD            | `Hud`       | DOM-driven — add new elements + setters                   |
| Audio          | `Audio`     | Add new synth methods (no external assets yet)            |
| Run telemetry  | `Game._end` | Writes `sunfall.run.v1` via `window.fracture.save`        |

---

## Planned extensions

### E1 — More biomes (Q3 v0.2)
Stretch the corridor and bolt on new branches. Each biome = one `addRoom` call
+ one `_addXDecor()` method.

- **Medbay** — bloodied gurneys, dripping IV bags, jump-scare cabinet that
  springs open. Drop a medkit cache + Hospital Drone (new enemy variant).
- **Hangar** — open volume with parked shuttles. Optional side-objective:
  hot-wire a shuttle for a *good* ending (escape pod variant of victory).
- **Crew Quarters** — narrow hallway with doorways. Many small rooms, audio
  logs (Web Audio synthesized voiceover). High lurker density.
- **Observation Deck** — windows looking at the sun. Pure atmosphere; no
  enemies. The sun fills the windows as the timer ticks down.
- **AI Core** — the heart of the antagonist. A boss arena that opens *after*
  the reroute is engaged but before you've cleared the bridge: she fights back.

### E2 — Enemy tiers (Q3 v0.2)
The `Robot.kind` string is the hook. Add:

- **Stalker** — invisible until close; outline only by flashlight glint.
  State `cloaked` → `revealed` based on flashlight cone hit.
- **Hive** — wall-mounted spawner. Periodically spits patrol drones until
  destroyed. Adds combat density without hand-placing enemies.
- **Bridge Sentinel** (boss) — large, three phases, drops one of the keys.
- **Crawler** — small, fast, ankle-biter. Tests headbob/ground-snap math.

### E3 — Weapons (Q4 v0.2.x)
Player currently has pistol only. `Player.ammo/reserve/reloading` are pistol-
specific; promote to a `Weapon` class and an inventory array.

- **Shotgun** — close, 8-pellet cone raycast.
- **Plasma cutter** — slow-charge beam; melts through Stalkers' cloak.
- **EMP grenade** — throwable; disables all robots in radius for 4s.
- **Wrench (melee)** — silent kill on lurkers in `hidden` state.

Hotbar `1`–`4` switch; `Q` quick-swap last weapon.

### E4 — Save / checkpoint system (Q3 v0.2)
v1 only saves the run record at end. Add **mid-run save** at three points
(after each key) so a 20-min session can be paused.

- Use `window.fracture.save('checkpoint', {...})`
- On boot, offer "Resume" if a checkpoint exists.
- Clear checkpoint on game-end (win or lose).

### E5 — Story / audio logs (Q4 v0.3)
Procedural-feel suspense with no asset budget:

- Plant 12 audio logs across the ship. Each is a short synthesized
  voice-modulated noise clip + on-screen transcript.
- Three crew narratives intercut: Captain (who tried to stop the AI), Botanist
  (who hid in hydroponics), Maintenance Chief (who BECAME a drone).
- Logs flagged as `seen` in fracture storage so they don't repeat across runs.

### E6 — Dynamic difficulty (Q4 v0.3)
v1 is static. Add `Game.difficulty` that scales:
- Robot spawn rate
- Drone HP / damage
- Ammo pickup richness
- Timer (Easy = 25 min, Normal = 20, Nightmare = 15)

Read from a Title-screen selector. Persist last choice in
`window.fracture.save('settings', ...)`.

### E7 — Procedural ship layout (Q1 v0.4)
Right now the layout is hand-coded inside `Game._initWorld`. Replace with a
seeded generator that produces a corridor + N branching biomes from a manifest:

```js
const SHIP_SPEC = {
  seed: 'heliogarde',
  corridor: { length: 60, width: 4 },
  branches: [
    { biome: 'hydroponics', side: 'w', offset: 0.2, size: [20,18] },
    { biome: 'town',        side: 'e', offset: 0.4, size: [22,20] },
    ...
  ],
};
```

Gives infinite replay without writing new code per biome.

### E8 — Asset upgrade pass (Q1 v0.4)
Currently uses BoxGeometry + StandardMaterial. Bring in:

- GLB models for drones (via `GLTFLoader`)
- Baked lightmaps for the static biome geometry
- Real audio (CC0 sci-fi pack) replacing synth — but keep synth as fallback
  for offline mode.
- Normal maps on walls, floor decals.

Keep model loading async + non-blocking — the game must still boot if assets
404 (degrades to v1 look).

### E9 — Fracture-City spiderweb (Q2 v0.5)
Wire Sun Fall into the ecosystem per `feedback-app-organization-spiderweb`:

- **Read** `tot.profile.v1` from Coherence Assessment → bias the antagonist's
  taunt logs toward the player's weakest axis (Vertical / Horizontal /
  Temporal). The AI knows you.
- **Write** `sunfall.run.v1` to ship history — already wired in v1.
- **Cross-app event** on victory: emit `fracture://event/ship-rerouted` so
  other apps (a future Heliogarde dashboard) can react.

### E10 — Multiplayer (stretch, post-v1.0)
Co-op: one player runs to the bridge, the other defends the reroute console
for 90s after it's engaged.

- Needs networking layer (Colyseus or peer-to-peer via WebRTC datachannel).
- All movement / shooting already deterministic at fixed dt — fits server-
  authoritative model with minimal changes.

---

## File-level extension map

When extending, edit these spots:

| Want to…                          | Edit                                              |
|-----------------------------------|---------------------------------------------------|
| Add a biome                       | `Game._initWorld` (call `addRoom`) + new `_add<Name>Decor()` |
| Add an enemy type                 | `Robot.constructor` switch on `kind` + AI in `update` |
| Add a pickup type                 | `World.addPickup` color/material + handler in `World.collectAt` callback in `Game._loop` |
| Add a HUD element                 | DOM in `index.html` + setter in `Hud`             |
| Add a sound                       | New method on `Audio` (pure Web Audio synth)      |
| Tune timing / damage              | `CFG` object at the top of `<script>`             |
| Change the win condition          | `Game._interact` `reroute` branch / `Game._end`   |

---

## Non-goals (deliberately deferred)

- VR support
- Mobile / touch controls
- Modding API
- Procedural narrative (LLM-driven NPCs)
- Steam launch (handled at the ecosystem level via Electron shell, not here)

---

## Calibration targets for v0.2

- Average completion time: 14–17 min (so the 20-min limit feels tight, not
  trivial).
- Average deaths per session: 1–2.
- Drone-to-ammo ratio: 1.1 (slight scarcity).
- "Felt scary" rating from 3 testers: ≥ 3 / 5.

Track these via the `sunfall.run.v1` record once a handful of real runs are
in the history.
