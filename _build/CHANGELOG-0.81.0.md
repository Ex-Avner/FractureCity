# Fracture City 0.81.0 · The Casting Booth and a livelier city

## The Casting Booth
- A neon kiosk on the Common Ground plaza, south of the garden by the
  arcades. Walk up to the counter and press E, or open it from Tools ·
  "Casting · your NPCs".
- The pedestal shows the person you are making, doing what their role does.
- Three steps:
  - Role: what they do (below).
  - Look: randomise for the role, randomise anything, copy your own look, or
    open the full wardrobe to dress them. Rare wardrobe pieces need owning,
    for NPCs too.
  - Story: name, street name, where they come from, what they do now, what
    they want, what happened to them, a habit, a secret, a catchphrase and a
    temper. Every field can be rolled again or rewritten, and so can the bio.
- Spawn at the booth or where you stand.
- Your cast: everyone you have out, how far away, and orders: follow, wait,
  move here, dismiss.

## Roles
- City life: wanderer, busker (with guitar and an open case), street
  preacher (on a crate), vendor (with a cart; talk to them for a snack that
  heals once a minute), graffiti artist (sprays as they go), skater (on a
  board), dancer, protester (with their own sign).
- Followers and helpers: bodyguard (fights brawlers, pickpockets and
  zombies near you), companion, crew hand (scrounges a few building blocks
  for you every three minutes online; salvage worth credits in solo), courier (online: walks a message to another resident
  and says it to their face; it also goes to chat).
- Trouble: pickpocket (bumps you and bolts; takes nothing real; catch them
  for 15 credits), brawler (small punches outside Common Ground; can be
  knocked down), rival crew (three in matching looks), zombie carrier
  (near anyone with zombie mode on, a zombie follows them out now and then).
  Trouble never acts inside Common Ground; spawned there, it walks out first.
- Talkers: gossip (collects rumours from other NPCs and passes them on),
  storyteller (sits and tells the whole story across visits), fixer (hands
  out errands: find someone, go somewhere, watch a spot; pays credits).
- Bodyguard (150), crew hand (120), rival crew (200) and zombie carrier (100)
  are unlocked once with credits. Everything else is free.

## Talking to them
- Every NPC talks in their own words from their backstory: three parts
  across visits, rumours about the other NPCs nearby, their take on Ned, and
  how they greet you depends on how you treated them.
- Speech bubbles over their heads when they bark, preach, sell or gossip.
- Your own NPCs take orders in conversation too.

## Online: shared and server-run
- The server owns spawned NPCs: who exists, their role, story, look, health,
  goals and fights. Everyone sees the same NPC in the same place doing the
  same thing.
- The server has no city geometry, so the nearest resident's game moves each
  NPC toward the server's goal with real collision and reports back (checked
  against speed). With nobody within 60 m the server moves them itself.
- 12 NPCs per resident, 40 per city. They leave ten minutes after their
  owner does. The Main Beta owner can clear someone's NPCs with
  /npcs @username.
- Brawlers' punches cost health like PvP; shooting trouble NPCs works
  outside Common Ground and pays 5 credits for a knockdown.
- In solo cities NPCs are saved with the city (24 at most), and trouble
  comes for you.

## Weird fauna
- Neon jellies drift over the streets (brighter after dark).
- Antenna-crows perch on roofs and lamps and shout corrections.
- Trash crabs in cups and cans scuttle off sideways.
- Cable snakes slither and spark.
- Pothole toads puff up and croak when you get close.
- Gutter hounds trot in packs and tag along if you stand still near them.
- Rumour slugs leave glowing trails at night.

## Street events
- About every minute or two, something happens in front of you: a busker
  draws a clapping crowd, a parade marches through with signs and a drum, a
  flash mob dances and freezes on cue, a pop-up market wheels in, two people
  square up and a ring forms (walk up and it stops), a preacher gathers
  listeners. Local to your game.

## Fixes
- Script version strings for files changed in 0.80 (resident motion, the
  online city, Tools) were not bumped, so browsers could keep old copies.

## Known limits
- Names and backstories are written by players and shown to everyone; the
  only moderation is the Main Beta owner's commands.
- Spawned NPCs are kept in server memory, not the database: a server restart
  clears them.
- Street events and fauna are local to each player.
