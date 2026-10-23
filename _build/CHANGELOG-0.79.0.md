# Fracture City 0.79.0 · Hotbar, inventory, shop, server wallet, city PvP

## Building, Minecraft style
- The 0.78 cursor build mode is gone: you could not turn your head while
  building. Building keeps the mouse with the view and the crosshair aims.
- B switches to building and shows an 8-slot hotbar. Keys 1–8 or the mouse
  wheel pick a slot. Right-click places what is in your hand; hold left-click
  to break a block, or left-click your own furniture to pick it back up.
- A slot can hold a block, a room-kit piece (a shape in a finish: wall,
  floor, stairs, window, counter, bookcase…) or a furniture object. The
  hotbar shows each item's icon and how many you hold.
- I, Tab or the ☰ button on the hotbar opens the inventory:
  - Backpack: what you hold. In solo cities, mined blocks can be sold.
  - Shop: 24 workshop finishes (by the block or in stacks of 16) and all 40
    furniture objects, priced by category.
  - Room kit: pick a finish you own, then a shape, then a slot.
  - Creative (solo only): everything, unlimited.
  - Click an item then a hotbar slot, or hover an item and press 1–8.
- Room-kit pieces use the finish blocks they are made of (a 3 × 3 wall uses
  nine). Undo gives them back.
- Creative replaces "free build" / "supplies". G toggles it in solo cities;
  it is refused online.
- A new solo city starts with a sofa and two rugs to try.
- Furniture placing no longer needs Creative. Atelier shapes are free.
- Ctrl+Z / Ctrl+Y undo with the tool in hand; plain blocks undo in Creative.
- On phones the hotbar sits at the top; tap a slot to pick it, tap ☰ for
  the inventory, tap the world to place.

## Server wallet (online)
- Each account has a wallet (300 credits to start) and an inventory held by
  the server. The shop is checked there.
- Building in the shared city is charged from the change in your saves:
  furniture you place uses one from your inventory, workshop blocks in your
  plot are counted (doors as two), and taking things down refunds them.
- Credits you earn in the city (jobs, zombies, street work) go to the server
  wallet, capped at 250 per claim, one claim every 2.5 s and 3,000 a day,
  because those events are simulated on your device.
- The HUD credits show your server balance online.

## PvP in the online city
- Shots now hit other residents everywhere except Common Ground and the
  building yard (x 144–216, z 0–72), which are safe.
- Every real shot is tested against the residents you can see and sent to
  the server, which checks both residents, the safe area, spawn protection,
  the weapon's cooldown and range, that the shot starts where you stand, and
  that it passes through the target's body. PvP damage is fixed per weapon
  (baton 20, pistol 20, shotgun 8 a pellet), not your mods.
- 100 PvP health, shown when hurt, with a red flash. A down pays the shooter
  25 credits; the downed resident sees DOWNED and is back in Common Ground
  after 4 seconds with a few seconds' protection. Shooting ends your own
  protection.
- Other residents' shots draw as tracers. Crossing into or out of the safe
  area says so.
- Limits: line of sight is your device's claim, because the server does not
  hold the city's buildings. PvP health is separate from the game's own
  health (falls, zombies), which the server cannot see.

## Also
- The server Dockerfile was missing common-challenge.cjs (and now needs
  economy.cjs); both are listed. Render runs the whole repository and was
  not affected.
- server/SHARED-CITY.md documents the economy and PvP.

## Tests
- server/economy.test.cjs: wallet, shop, unknown items, overspending,
  hotbar, claim cooldown and daily cap, furniture charge and refund, free
  Atelier shapes, plot block charge and refund, PvP hit, cooldown, miss,
  safe zones, origin check, down, payout, respawn and seq bump.
- _test/mc-build.test.cjs: hotbar keys and wheel, furniture placed, used up
  and picked up, shop, room-kit pieces and their undo, Creative, the online
  wallet charging a placed sofa, Creative refused online, PvP between a
  browser resident and a second resident on the server, the phone hotbar.
- _test/build-dock.test.cjs rewritten for the remaining build module:
  undo rules and phone tap-to-place.
- structures and main-beta server tests buy their blocks first; the
  furniture, city-build, ledger-touch and fixes-0781 tests use the hotbar.
