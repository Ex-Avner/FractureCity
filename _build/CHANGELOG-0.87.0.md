# Fracture City 0.87.0 · Outgrow, and online blocks that place

## New cabinet: OUTGROW
- A survival arcade game on the west lawn of Common Ground (x 152.5,
  z 50.5, screen facing the court). E to play, like the other campus
  cabinets.
- Every hit grows both sides: the biter grows more, the bitten a little.
  Bite anything under half your size and you eat it. Anything 2.5 times
  your size can eat you. Green rings mark food, red dashed rings mark
  things that can eat you.
- Rivals (Gnashers, Lurkers, Spitters, Bloats, each with a name) fight
  each other too and evolve on the same rules, so hiding loses: the
  first thing to reach full size (100) wins, you or them.
- You evolve at 15, 30, 50 and 75 (Crawler, Biter, Brute, Titan) and
  unlock Dash, Spines (biters get stung), Spit and Roar. Rivals grow
  tendrils, spines, more eyes and a crest as they evolve; Lurkers dash,
  Spitters spit and Titans roar.
- HUD: your size against the apex rival's, the next three rivals, a
  clock and an arrow to the apex when it is off screen. Best time to full
  size is kept on the device.
- Keyboard (WASD, J or Space or click to bite, K dash, L spit, I roar,
  P pause) and touch (stick, BITE, DASH, SPIT, ROAR). A round runs about
  two to three minutes.
- apps/outgrow, served by the city server and included in the Netlify
  build. Fonts bundled locally (Anton, JetBrains Mono, OFL).

## Fix: online building said you had no blocks
- Online, holding a workshop block bought in the shop and placing it
  checked the solo save's mined blocks, so it said "No … in hand" while
  the inventory showed plenty. Placing now checks the inventory's count
  (the server's), and a block placed inside your plot saves straight to
  it; the server charges it and the inventory updates. Out of blocks says
  so with the inventory's numbers.
- Single blocks used to be refused online outright ("Use the room
  workshop"). They now place inside your own plot; outside it, or with a
  non-workshop block, the message says what is allowed.

## Tests
- New: _test/outgrow.test.cjs, _test/online-blocks.test.cjs.
- campus-arcades.test.cjs covers six cabinets.
