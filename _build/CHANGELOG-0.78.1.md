# Fracture City 0.78.1 · Fixes

## Furniture that would not place
- Online, a resident could place 300 pieces per city. Each catalogue object is
  8 to 13 pieces, so the limit arrived after about 30 objects, and the refusal
  was written into the collapsed online panel where nobody saw it. The limit
  is now 1,000 pieces per resident and 4,000 per city (server and client), and
  every refusal or failed save also shows as a toast.
- On phones in the online city, the online panel covered the build dock's
  Furniture and Atelier tabs. The dock now sits above it.
- The dock's Furniture tab opens the catalogue when you have no pieces of your
  own yet, even when other residents have.

## Zombies on phones
- New ZOMBIES chip in the top row starts and stops the siege; it turns red
  while the siege is on. Zombies and Peaceful are also in the Tools tray (F2).
- The goal banner, online panel and Tools pill no longer cover the chip row,
  the chips fit a portrait phone, and the siege banner moves out of the way.

## Tests
- New _test/fixes-0781.test.cjs: limits, every phone chip tappable, ZOMBIES
  starts and stops the siege, the dock clear of the online panel on a phone,
  and a refused placement showing on screen.
