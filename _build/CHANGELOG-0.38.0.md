# Fracture City 0.38.0

## Neighborhood stories

Six optional quests: The Last Tram Home, A Warm Window, A Quiet Frequency, The Carbon Copy, The Spare Wheel, and Names on the Air. Each has authored conversations, choices, world-space stops and a completion response. K opens the story board. Track a job, follow its marker, and press E nearby. Decisions and completion travel inside the existing save slot; a new city clears them. These stories do not gate the five main campaign chapters.

## Districts network alpha

Three compact authored maps support up to twelve residents each. A protected central plaza supports social gathering; PvP is active outside. The dedicated server controls movement, shared map collisions, ammunition, firing rate, hit detection, damage, kills, respawns and shared contract completion. Chat, waves, invite codes, readiness, host controls, reconnect reservations and a residents scoreboard are included. Maps have first/third-person cameras and articulated residents using the main game’s human head asset.

This is a separate multiplayer mode. The campaign, procedural city, building, vehicles, skateboarding, full wardrobe and story economy are not network-synchronized. Rooms and reputation are temporary; no persistent online account or economy is claimed.

## Validation

Server validation: 28 checks covering twelve-seat capacity, authentication, host/ready gates, finite input, sequence checks, movement limits, cover, damage, cooldowns, safe zones, reloads, respawns, map bounds, contract proximity/reward integrity, chat escaping, room isolation, host transfer and expiry.

Browser validation: 13 checks using two rendered clients and ten additional simulated seats, including shared entry, movement, chat, reload/reconnect, six local stories, quest completion/reward integrity, and save isolation/restoration.

Local load exercise: twelve live event streams with 200 input rounds each. A sample measured 4.4 ms request p95 and 162 MB combined Node process memory on loopback. That is not WAN latency or a production capacity guarantee. Real internet playtests remain required. Docker image and Fly deployment are configured but unexecuted on this machine.

Hosting: one paid Fly.io machine, one region near the initial players, one instance until room-aware routing exists. No paid account or public server has been created. See server/README.md.

Final game regressions passed: startup 21, character studio 14, enemies/arcade 16, world 32, prologue/systems 65, standalone build 17, and campaign-flow 15. The existing live saves and unrelated work were preserved.
