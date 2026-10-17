# Fracture City 0.65.0 · The Seam

## Added
- The Seam (the-seam.js): a new district just east of Makers' Mile, about
  70 m from the Main Beta arrival. The city cracked open there. The ground is
  heaved up a block, a fissure of dead-channel light runs through it, and
  slabs of street hang over the crack with a lamp and an upside-down taxi
  still attached. A sign at Common Ground points the way.
- Farming on the real clock. Twelve raised beds, four open to start. Four
  crops: headline wheat (4 min), static melon (12 min), echo corn (30 min)
  and sodium tubers (90 min, only under a lamp-ward). Crops keep growing
  while the game is closed. Walk up to a bed, press E (or tap), plant with
  1 to 4, harvest when the diamond turns over it. New farmers get free seed
  packets. Echo corn whispers something it overheard when you pick it.
- The Ledger, the shed on the road side of the Seam:
  - Market: sell your harvest for credits. Each crop follows a kind of story
    on the real news wire (energy for tubers, food for wheat, tech for
    melons, speeches and reports for corn). More of those stories today
    means a higher price, and the headline that moved it is quoted, labeled
    REAL NEWS and linked. Every sale nudges that day's price down.
  - Build: clear more plots, build and upgrade six lamp-wards, raise the
    Retraction fence. Ranks (Squatter to Keeper of the Crack) unlock with
    harvests and gate how far you can build.
  - Creatures, Almanac, and a report of raids while you were away.
- Misprints: crumpled front pages with ink legs and a CORRECTION stamp for
  an eye. At night, while you are in the Seam, waves crawl out of the crack
  and go for your crops. Shoot them; lamp-wards zap anything in range. A
  Misprint that reaches a bed sets the crop back. Kills drop ink, which
  builds and upgrades wards and the fence.
- Raids while you are away: about one every ninety minutes, up to six,
  decided by your wards, fence and creatures on guard.
- The daily almanac. Each day's sky hue changes the Seam: Wheat Rush,
  Static Bloom, Echo Season and Tuber Night double one crop's growth and
  bring that crop's creature migrating through; Misprint Moon brings bigger
  raids and double ink; Rust Market pays a quarter more; Quiet Haze has no
  raids.
- Tameable creatures: lamp moths, many-winged pigeons, sidewalk eels and
  rumour cats wander into the Seam. Feed one the crop it loves three times
  (twice on its migration day) and it is yours, up to four. Guarding: moths
  extend ward range, pigeons peck Misprints, eels slow them, cats warn of
  raids and thin each wave. Following: they come with you anywhere in the
  city, and a rumour cat repeats things it overheard, sometimes a real
  headline.
- City wildlife everywhere (city-wildlife.js): lamp moths circle the street
  lamps at night, flocks of many-winged pigeons land on the pavement and
  burst off when you walk up, and after dark a sidewalk eel sometimes arcs
  out of the asphalt and dives back in.

## Notes
- Farm state is per account and kept in this browser, like NPC memory. It
  does not follow you to another device yet, and the real-time clock is the
  device's own.
- The Seam occupies chunks 10..11 × 0..1. Nothing authored lived there.

## Tests
- _test/the-seam.test.cjs: generation (sealed crack, beds, Ledger), planting
  and real-time growth, market from real headlines, ranks and wards, raids
  away, a live raid killed by a ward, a Misprint eating a crop, taming and a
  following pet, E-to-plant, wildlife, persistence across reload.
